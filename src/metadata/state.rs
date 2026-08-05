use crate::errors::{ConvertedError, ConvertedResult, JsResult, with_custom_error_sync};
use crate::metadata::host::cache_host_map;
use crate::session::SessionWrapper;
use crate::utils::cache::{ReferenceCache, SingleNapiRefCache};
use crate::utils::js_ctor::{
    build_local_strategy, build_network_topology_strategy, build_other_strategy,
    build_simple_strategy, js_constructible_class,
};
use crate::utils::js_instance::JsInstance;
use crate::utils::napi_ref::NapiRef;
use crate::utils::to_napi_obj::NamedMap;
use napi::Env;
use napi::bindgen_prelude::{FnArgs, JavaScriptClassExt, Reference};
use scylla::cluster::metadata::{Keyspace, Strategy};
use std::collections::HashMap;
use std::sync::Arc;

/// Tags the `Record<string, KeyspaceMetadata>` handed to JS by `getAllKeyspaces`.
pub enum KeyspaceRecord {}

/// Tags the object handed to JS by `KeyspaceMetadata#strategy`.
pub enum StrategyValue {}

/// A snapshot of the cluster's topology and schema metadata, as known by the driver
/// at a given point in time.
///
/// Cluster metadata is refreshed periodically by the Rust driver in the background.
/// Rather than mutating the previous snapshot in place, the driver produces a brand
/// new `Arc<ClusterState>` on every refresh. This lets us cheaply detect whether the
/// snapshot backing a given `ClusterSnapshot` is stale, by comparing Arc pointers.
pub(crate) struct ClusterSnapshot {
    pub(crate) inner: Arc<scylla::cluster::ClusterState>,
    /// All nodes known by the Rust driver at the time this snapshot was created, as a JS `HostMap`
    /// of `Host` objects keyed by address.
    ///
    /// The `NapiRef` releases the JS object it pins automatically when dropped (i.e. when this
    /// `ClusterSnapshot` itself is dropped, or replaced by a fresher one), so no custom finalizer
    /// is needed here to avoid leaking a `HostMap` on every cluster state refresh. Pinning the map
    /// keeps every `Host` it holds alive, so the hosts need no separate `NapiRef`s.
    pub(crate) host_map: NapiRef<js_constructible_class::HostMap>,
    /// Cache of keyspaces of this snapshot, populated lazily.
    keyspace_cache: ReferenceCache<KeyspaceWrapper>,
    /// The record of every keyspace, as handed to JS, built on first use.
    keyspaces_record: SingleNapiRefCache<KeyspaceRecord>,
}

impl ClusterSnapshot {
    pub(crate) fn new(inner: Arc<scylla::cluster::ClusterState>, env: &Env) -> napi::Result<Self> {
        let host_map = cache_host_map(&inner, env)?;
        Ok(ClusterSnapshot {
            inner,
            host_map,
            keyspace_cache: ReferenceCache::new(),
            keyspaces_record: SingleNapiRefCache::new(),
        })
    }

    /// Returns the cached `KeyspaceWrapper` reference for `name`, converting and caching it lazily
    /// if this is the first lookup for that name in this snapshot. Returns `None` if no such
    /// keyspace exists in the Rust driver's cluster state.
    fn keyspace_wrapper(
        &self,
        env: &Env,
        name: &str,
    ) -> ConvertedResult<Option<Reference<KeyspaceWrapper>>> {
        self.keyspace_cache
            .get_or_init(env, name, || match self.inner.get_keyspace(name) {
                Some(_) => {
                    let wrapper = KeyspaceWrapper::new(Arc::clone(&self.inner), name.to_owned());
                    ConvertedResult::Ok(Some(
                        wrapper.into_reference(*env).map_err(ConvertedError::from)?,
                    ))
                }
                None => ConvertedResult::Ok(None),
            })
    }

    /// Returns the record of every keyspace in this snapshot, keyed by name, building and pinning
    /// it on the first call.
    fn all_keyspaces_record<'env>(
        &self,
        env: &'env Env,
    ) -> ConvertedResult<JsInstance<'env, KeyspaceRecord>> {
        self.keyspaces_record.get_or_init(env, || {
            let wrappers = self.keyspace_cache.get_or_init_all(env, || {
                self.inner
                    .keyspaces_iter()
                    .map(|(name, _keyspace)| {
                        let wrapper =
                            KeyspaceWrapper::new(Arc::clone(&self.inner), name.to_owned());
                        let reference =
                            wrapper.into_reference(*env).map_err(ConvertedError::from)?;
                        ConvertedResult::Ok((name.to_owned(), reference))
                    })
                    .collect::<ConvertedResult<HashMap<_, _>>>()
            })?;
            let record: NamedMap<String, Reference<KeyspaceWrapper>> = NamedMap::new(wrappers);
            record.into_jsinstance(env).map_err(ConvertedError::from)
        })
    }
}

/// Describes a keyspace in the cluster. Tables and materialized views, and user defined types
/// are populated lazily and cached.
#[napi(js_name = "KeyspaceMetadata")]
pub struct KeyspaceWrapper {
    /// The cluster state this keyspace was looked up in.
    ///
    /// Holding the `Arc` rather than a cloned `Keyspace` avoids deep-copying every table, view and
    /// user defined type of the keyspace on each lookup, and pins the exact snapshot the wrapper
    /// was built from: the metadata it reports stays the one it was created with, even after the
    /// driver refreshes its cluster state.
    cluster_state: Arc<scylla::cluster::ClusterState>,
    /// Name of the keyspace within `cluster_state`.
    name: String,
    /// The keyspace's replication strategy, as handed to JS, built on first use.
    strategy_value: SingleNapiRefCache<StrategyValue>,
}

impl KeyspaceWrapper {
    pub(crate) fn new(cluster_state: Arc<scylla::cluster::ClusterState>, name: String) -> Self {
        KeyspaceWrapper {
            cluster_state,
            name,
            strategy_value: SingleNapiRefCache::new(),
        }
    }

    /// The keyspace this wrapper describes.
    ///
    /// Infallible in practice: the keyspace was present when the wrapper was built, and the `Arc`
    /// keeps that cluster state alive unchanged for as long as the wrapper lives, so it cannot
    /// disappear from under us.
    fn keyspace(&self) -> &Keyspace {
        self.cluster_state
            .get_keyspace(&self.name)
            .expect("the keyspace was present when this wrapper was built, and the pinned cluster state cannot change")
    }
}

/// Converts the Rust driver's `Strategy` into one of the four JS classes declared in
/// `lib/metadata/strategy.ts`, by calling that class's registered constructor. The declared
/// union is not derived from the Rust types, so the two are kept in step by the constructor
/// signatures alone: changing a field here without changing `strategy.ts` is a runtime mismatch,
/// not a compile error.
#[deny(clippy::wildcard_enum_match_arm)]
fn convert_rust_strategy<'env>(
    env: &'env Env,
    strategy: &Strategy,
) -> napi::Result<JsInstance<'env, StrategyValue>> {
    let instance = match strategy {
        Strategy::SimpleStrategy { replication_factor } => {
            build_simple_strategy(env, FnArgs::from(((*replication_factor as u32),)))?.into_object()
        }
        Strategy::NetworkTopologyStrategy {
            datacenter_repfactors,
        } => {
            let repfactors = datacenter_repfactors
                .iter()
                .map(|(datacenter, repfactor)| (datacenter.as_str(), *repfactor as u32))
                .collect();
            build_network_topology_strategy(env, FnArgs::from((NamedMap::new(repfactors),)))?
                .into_object()
        }
        Strategy::LocalStrategy => build_local_strategy(env, ())?.into_object(),
        Strategy::Other { name, data } => {
            let data = data
                .iter()
                .map(|(key, value)| (key.as_str(), value.as_str()))
                .collect();
            build_other_strategy(env, FnArgs::from((name.as_str(), NamedMap::new(data))))?
                .into_object()
        }
        _ => unreachable!(
            "If a new Strategy variant is added, update convert_rust_strategy to handle it."
        ),
    };
    Ok(JsInstance::from_object(instance))
}

#[napi]
impl SessionWrapper {
    /// Returns metadata about the keyspace with the given name, or `null` if it does not exist.
    ///
    /// The keyspace is converted lazily and cached: repeated lookups for the same name
    /// return the same JS object.
    #[napi(ts_return_type = "KeyspaceWrapper | null")]
    pub fn get_keyspace_metadata(
        &self,
        env: &Env,
        name: String,
    ) -> JsResult<Option<Reference<KeyspaceWrapper>>> {
        with_custom_error_sync(|| {
            self.with_cluster_snapshot(env, |snapshot: &ClusterSnapshot| {
                snapshot.keyspace_wrapper(env, &name)
            })
        })
    }

    /// Returns metadata about every keyspace in the cluster, keyed by name.
    ///
    /// Keyspaces are converted lazily and cached: repeated lookups for the same keyspace,
    /// whether through this method or through `get_keyspace_metadata`, return the same JS object.
    #[napi(ts_return_type = "Readonly<Record<string, KeyspaceWrapper>>")]
    pub fn get_all_keyspaces<'env>(
        &self,
        env: &'env Env,
    ) -> JsResult<JsInstance<'env, KeyspaceRecord>> {
        with_custom_error_sync(|| {
            self.with_cluster_snapshot(env, |snapshot: &ClusterSnapshot| {
                snapshot.all_keyspaces_record(env)
            })
        })
    }
}

/// **Public JS API**: this is the object users get from `Metadata#getKeyspace`, exposed as
/// `KeyspaceMetadata`, so every getter and method below is part of the driver's public surface.
#[napi]
impl KeyspaceWrapper {
    /// Replication strategy used by the keyspace.
    ///
    /// One of the four classes declared in `lib/metadata/strategy.ts`, constructed through that
    /// class's registered constructor; the union they form is declared there rather than derived
    /// from Rust, so it is named here explicitly.
    #[napi(getter, ts_return_type = "import('./lib/metadata/strategy').Strategy")]
    pub fn strategy<'env>(&self, env: &'env Env) -> JsResult<JsInstance<'env, StrategyValue>> {
        with_custom_error_sync(|| {
            self.strategy_value.get_or_init(env, || {
                convert_rust_strategy(env, &self.keyspace().strategy).map_err(ConvertedError::from)
            })
        })
    }

    /// Whether the keyspace has durable writes enabled.
    #[napi(getter)]
    pub fn durable_writes(&self) -> bool {
        self.keyspace().durable_writes
    }
}
