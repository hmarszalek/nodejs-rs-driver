use napi::Env;

/// A `napi::bindgen_prelude::Reference<T>` (and other N-API handles built on top of it) can only
/// ever be safely created, read, or dropped on the thread that owns the JS engine it was created
/// for. Because of that, `Reference<T>` is (rightfully) not `Send`.
///
/// However, some wrapper types (e.g. `SessionWrapper`) also expose `async` methods, and for those
/// to compile, `&Self` must be `Send`, which in turn requires every field of `Self` to be `Sync`.
/// This wrapper asserts `Send`/`Sync` to satisfy the compiler when carrying fields that do not
/// fulfill those requirements.
///
/// # Safety
/// It is the callers responsibility, that values of this type are constructed, read, or dropped
/// only from the JS thread (i.e. from within a synchronous `#[napi]` function, or a finalizer
/// callback - both of which N-API always runs on the JS thread). Do not construct, read, or drop
/// this from within an `async` method (across an `.await` point, control may resume on a different
/// thread). `new`/`get` help enforce this at compile time: both require a `&Env` to be passed in,
/// and `Env` is itself neither `Send` nor `Sync`.
pub(crate) struct JsThreadOnly<T>(T);

unsafe impl<T> Send for JsThreadOnly<T> {}
unsafe impl<T> Sync for JsThreadOnly<T> {}

impl<T> JsThreadOnly<T> {
    /// Wraps `value`, asserting that it (and everything reachable from it) will only ever be
    /// touched from the JS thread.
    ///
    /// # Safety
    /// The caller must be on the JS thread. See the type-level safety comment.
    pub(crate) fn new(value: T, _env: &Env) -> Self {
        JsThreadOnly(value)
    }

    /// Borrows the wrapped value.
    ///
    /// # Safety
    /// The caller must be on the JS thread. See the type-level safety comment.
    pub(crate) fn get(&self, _env: &Env) -> &T {
        &self.0
    }
}
