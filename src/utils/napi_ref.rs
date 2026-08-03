use napi::Env;
use napi::bindgen_prelude::{Object, ToNapiValue, check_status};
use napi::sys;
use std::marker::PhantomData;
use std::ptr;

use crate::utils::js_instance::JsInstance;

/// A typed abstraction over a raw N-API owning a strong reference that pins a `JsInstance<C>`
/// The `C` type parameter records which JS class the pinned object is an instance of, so retrieving
/// it later yields a correctly-typed `JsInstance<'_, C>` rather than an untyped `Object`. `JsInstance`
/// is a plain JS object not wrapped as a napi-rs `#[napi]` class instance, so `Reference<T>` cannot be used.
///
/// Unlike a raw `napi_ref`, which has no `Drop` semantics of its own, `NapiRef` releases the reference
/// it owns automatically when dropped with `napi_delete_reference`.
///
/// There is always exactly one `NapiRef` per underlying `napi_ref`, created with strong count 1 by
/// `new` and released by `Drop`, which always observes strong count 1 and so always deletes the
/// reference.
///
/// # Safety
/// Every `NapiRef` must only be created, read, or dropped on the JS thread that owns the `Env` it was created with.
pub struct NapiRef<C> {
    napi_ref: sys::napi_ref,
    env: sys::napi_env,
    _class: PhantomData<C>,
}

impl<C> NapiRef<C> {
    /// Pins `value` (a `C` instance) against garbage collection with a fresh, strong (ref count 1)
    /// `napi_ref`, taking ownership of the reference's lifetime.
    pub(crate) fn new(env: &Env, value: JsInstance<'_, C>) -> napi::Result<Self> {
        assert_eq!(
            value.env_raw(),
            env.raw(),
            "NapiRef::new called with a JsInstance from an Env different from the one it is being pinned in",
        );
        let napi_val = unsafe { ToNapiValue::to_napi_value(env.raw(), value) }?;
        let mut napi_ref = ptr::null_mut();
        check_status!(
            unsafe { sys::napi_create_reference(env.raw(), napi_val, 1, &mut napi_ref) },
            "Failed to create N-API reference",
        )?;
        Ok(Self {
            napi_ref,
            env: env.raw(),
            _class: PhantomData,
        })
    }

    /// Retrieves the `C` instance currently pinned by this reference, as a `JsInstance<'a, C>` whose
    /// lifetime is tied to the borrow of `env` passed in - preventing the returned object from
    /// outliving the `Env` it was retrieved through. `env` must refer to the same environment
    /// this `NapiRef` was created with.
    #[expect(dead_code)]
    pub(crate) fn get<'env>(&self, env: &'env Env) -> napi::Result<JsInstance<'env, C>> {
        assert_eq!(
            self.env,
            env.raw(),
            "NapiRef::get called with an Env different from the one it was created with",
        );
        let mut result = ptr::null_mut();
        check_status!(
            unsafe { sys::napi_get_reference_value(env.raw(), self.napi_ref, &mut result) },
            "Failed to get N-API reference value",
        )?;
        Ok(JsInstance::from_object(Object::from_raw(env.raw(), result)))
    }
}

impl<C> Drop for NapiRef<C> {
    /// Deletes the underlying `napi_ref` (`napi_delete_reference`), releasing the value it pins.
    ///
    /// This can call `napi_delete_reference` unconditionally, as `NapiRef` never has more than one
    /// live handle to a given `napi_ref`, and `napi_delete_reference` itself does not require
    /// the count to be 0 first - it deletes the reference and releases whatever it was pinning
    /// regardless of the current count.
    fn drop(&mut self) {
        let delete_status = unsafe { sys::napi_delete_reference(self.env, self.napi_ref) };
        assert_eq!(
            delete_status,
            sys::Status::napi_ok,
            "Failed to delete N-API reference"
        );
    }
}
