use crate::metadata::host::cache_host_map;
use crate::utils::js_ctor::{
    build_local_strategy, build_network_topology_strategy, build_other_strategy,
    build_simple_strategy, js_constructible_class,
};
use crate::utils::js_instance::JsInstance;
use crate::utils::napi_ref::NapiRef;
use crate::utils::to_napi_obj::NamedMap;
use napi::Env;
use napi::bindgen_prelude::FnArgs;
use scylla::cluster::metadata::Strategy;
use std::sync::Arc;

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
}

impl ClusterSnapshot {
    pub(crate) fn new(inner: Arc<scylla::cluster::ClusterState>, env: &Env) -> napi::Result<Self> {
        let host_map = cache_host_map(&inner, env)?;
        Ok(ClusterSnapshot { inner, host_map })
    }
}

/// Converts the Rust driver's `Strategy` into one of the four JS classes declared in
/// `lib/metadata/strategy.ts`, by calling that class's registered constructor. The declared
/// union is not derived from the Rust types, so the two are kept in step by the constructor
/// signatures alone: changing a field here without changing `strategy.ts` is a runtime mismatch,
/// not a compile error.
#[deny(clippy::wildcard_enum_match_arm)]
#[expect(unused)]
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
