use std::cell::RefCell;
use std::collections::HashMap;

use napi::Env;
use napi::bindgen_prelude::Reference;

use crate::errors::{ConvertedError, ConvertedResult};
use crate::utils::js_instance::JsInstance;
use crate::utils::napi_ref::NapiRef;

/// One of the two ways a converted JS value can be kept alive in a `JsCache`.
///
/// The cache logic is identical for both; they differ only in how a value is pinned against
/// garbage collection (`store`) and how a fresh handle to it is produced on lookup (`load`).
pub(crate) trait CacheEntry: Sized + 'static {
    /// The value the cache is handed when an entry is created, and hands back out on lookup.
    ///
    /// This is generic over the N-API handle scope's lifetime because handles to plain JS objects
    /// (`JsInstance<'env, C>`) are only valid within the scope they were obtained in, so a fresh
    /// one has to be produced per lookup rather than stored.
    type Value<'env>;

    /// Pins `value`, producing the entry to store in the cache.
    fn store<'env>(env: &'env Env, value: Self::Value<'env>) -> ConvertedResult<Self>;

    /// Produces a fresh handle to the cached value, tied to `env`'s handle scope.
    fn load<'env>(&self, env: &'env Env) -> ConvertedResult<Self::Value<'env>>;
}

/// `#[napi]` class instances: napi-rs already keeps them alive behind a reference count, so the
/// `Reference<V>` is stored directly and cloned for each lookup.
impl<V: 'static> CacheEntry for Reference<V> {
    type Value<'env> = Reference<V>;

    fn store(_env: &Env, value: Reference<V>) -> ConvertedResult<Self> {
        Ok(value)
    }

    fn load(&self, env: &Env) -> ConvertedResult<Reference<V>> {
        self.clone(*env).map_err(ConvertedError::from)
    }
}

/// Plain JS objects (classes built with `js_ctor`): these have to be pinned behind a raw `napi_ref`.
impl<C: 'static> CacheEntry for NapiRef<C> {
    type Value<'env> = JsInstance<'env, C>;

    fn store<'env>(env: &'env Env, value: JsInstance<'env, C>) -> ConvertedResult<Self> {
        NapiRef::new(env, value).map_err(ConvertedError::from)
    }

    fn load<'env>(&self, env: &'env Env) -> ConvertedResult<JsInstance<'env, C>> {
        self.get(env).map_err(ConvertedError::from)
    }
}

/// A lazily-populated cache for converted JS values, keyed by name.
///
/// The same underlying JS object is handed out for a given key across repeated lookups, whether it
/// is reached through the single-key path `get_or_init` or the full-map path (`get_or_init_all`).
///
/// # Concurrency
///
/// These caches only ever live inside N-API class instances that are exclusively accessed on the
/// JS thread. A plain `RefCell` is therefore sufficient and no locking is required.
pub(crate) struct JsCache<E: CacheEntry> {
    state: RefCell<CacheState<E>>,
}

/// Entries and the flag describing them live behind one `RefCell`, so a reader can never observe
/// `complete` set while the entries it refers to are still being filled in, and the two cannot
/// drift apart.
struct CacheState<E> {
    entries: HashMap<String, E>,
    /// Set once `get_or_init_all`'s builder has run to completion.
    complete: bool,
}

/// Cache of `#[napi]` class instances.
pub(crate) type ReferenceCache<V> = JsCache<Reference<V>>;

/// Cache of plain JS objects built through `js_ctor`.
pub(crate) type NapiRefCache<C> = JsCache<NapiRef<C>>;

impl<E: CacheEntry> Default for JsCache<E> {
    fn default() -> Self {
        Self::new()
    }
}

impl<E: CacheEntry> JsCache<E> {
    pub(crate) fn new() -> Self {
        JsCache {
            state: RefCell::new(CacheState {
                entries: HashMap::new(),
                complete: false,
            }),
        }
    }

    /// Retrieves a single cached value or initializes it lazily if missing.
    /// - If the key exists: returns a fresh handle to the cached value.
    /// - If the key is missing and the full set has already been loaded via `get_or_init_all`
    ///   (i.e. this cache is `complete`): the miss is authoritative, so `f` is not called and
    ///   `Ok(None)` is returned directly.
    /// - Otherwise: computes the value with `f`, inserts it (if `Some`) and returns it.
    pub(crate) fn get_or_init<'env, F>(
        &self,
        env: &'env Env,
        key: &str,
        f: F,
    ) -> ConvertedResult<Option<E::Value<'env>>>
    where
        F: FnOnce() -> ConvertedResult<Option<E::Value<'env>>>,
    {
        {
            let state = self.state.borrow();
            if let Some(existing) = state.entries.get(key) {
                return Ok(Some(existing.load(env)?));
            }
            if state.complete {
                return Ok(None);
            }
        }

        let Some(value) = f()? else {
            return Ok(None);
        };

        // `f` and `store` run with no borrow held, so a reentrant cache access from a JS
        // constructor invoked while building the value cannot panic on the `RefCell`.
        let entry = E::store(env, value)?;
        let mut state = self.state.borrow_mut();
        let stored = state.entries.entry(key.to_owned()).or_insert(entry);
        Ok(Some(stored.load(env)?))
    }

    /// Computes the full set of entries via `f` the first time this is called, and returns every
    /// cached entry's current handle on every call. Subsequent calls skip `f` entirely, avoiding
    /// both redundant conversion work and any freshly-pinned-but-discarded JS objects.
    ///
    /// The returned handles are fresh, so they can be handed to JS while the cache keeps ownership
    /// of the pinned originals.
    pub(crate) fn get_or_init_all<'env, F>(
        &self,
        env: &'env Env,
        f: F,
    ) -> ConvertedResult<HashMap<String, E::Value<'env>>>
    where
        F: FnOnce() -> ConvertedResult<HashMap<String, E::Value<'env>>>,
    {
        if !self.state.borrow().complete {
            for (key, value) in f()? {
                let entry = E::store(env, value)?;
                self.state.borrow_mut().entries.entry(key).or_insert(entry);
            }
            self.state.borrow_mut().complete = true;
        }

        let state = self.state.borrow();
        state
            .entries
            .iter()
            .map(|(key, entry)| Ok((key.clone(), entry.load(env)?)))
            .collect()
    }
}

/// A lazily-populated cache for a single converted JS value.
///
/// The keyed `JsCache` above is the wrong shape for something there is exactly one of per
/// snapshot, such as the record of all keyspaces: there is no name to look it up by. The pinning
/// and the borrow discipline are the same, so this shares `CacheEntry` with it.
pub(crate) struct JsValueCache<E: CacheEntry> {
    entry: RefCell<Option<E>>,
}

/// Cache of a single plain JS object.
pub(crate) type SingleNapiRefCache<C> = JsValueCache<NapiRef<C>>;

impl<E: CacheEntry> Default for JsValueCache<E> {
    fn default() -> Self {
        Self::new()
    }
}

impl<E: CacheEntry> JsValueCache<E> {
    pub(crate) fn new() -> Self {
        JsValueCache {
            entry: RefCell::new(None),
        }
    }

    /// Returns a fresh handle to the cached value, computing and pinning it with `f` on the first
    /// call.
    pub(crate) fn get_or_init<'env, F>(
        &self,
        env: &'env Env,
        f: F,
    ) -> ConvertedResult<E::Value<'env>>
    where
        F: FnOnce() -> ConvertedResult<E::Value<'env>>,
    {
        if let Some(existing) = self.entry.borrow().as_ref() {
            return existing.load(env);
        }

        // As in `JsCache::get_or_init`, `f` and `store` run with no borrow held, so a reentrant
        // cache access from a JS constructor invoked while building the value cannot panic on the
        // `RefCell`.
        let value = f()?;
        let entry = E::store(env, value)?;
        let mut slot = self.entry.borrow_mut();
        slot.get_or_insert(entry).load(env)
    }
}
