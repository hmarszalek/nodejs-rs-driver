//! JS-side tests for `crate::utils::js_instance::JsInstance`, `crate::utils::napi_ref::NapiRef`
//! and the `define_js_ctor!` macro (`crate::utils::js_ctor`), exercised together through a
//! test-only `TestJsClass(name, value)` JS class (see `js_constructible_class::TestJsClass`).
use napi::Env;
use napi::bindgen_prelude::FnArgs;

use crate::errors::{ConvertedResult, JsResult, with_custom_error_sync};
use crate::utils::js_ctor::{build_test_js_class, js_constructible_class};
use crate::utils::js_instance::JsInstance;

/// Builds a fresh `TestJsClass(name, value)` instance directly (via `define_js_ctor!`'s `build_fn`),
/// without pinning it.
#[napi(ts_return_type = "{ name: string, value: number }")]
pub fn tests_build_test_js_class<'env>(
    name: String,
    value: i32,
    env: &'env Env,
) -> JsResult<JsInstance<'env, js_constructible_class::TestJsClass>> {
    with_custom_error_sync(|| {
        let instance = build_test_js_class(env, FnArgs::from((name.as_str(), value)))?;
        ConvertedResult::Ok(instance)
    })
}
