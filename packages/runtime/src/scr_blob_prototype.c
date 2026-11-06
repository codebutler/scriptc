/* Canonical Blob/File prototype identity and the borrowed arrayBuffer reader.
 * This unit links only when the existing prototype/method IR names Blob/File.
 * Ordinary Blob reads keep their existing native implementation and link set.
 * Prototype mutation, wider member reflection and instance overrides remain
 * explicit boundaries; these objects do not pretend to be a full WebIDL API. */
#include "scr_runtime.h"

#include <stdio.h>
#include <string.h>

static SCR_TL ScrDyn *blob_prototype;
static SCR_TL ScrDyn *file_prototype;

static void blob_prototypes_cleanup(void) {
  scr_dyn_release(file_prototype);
  scr_dyn_release(blob_prototype);
  file_prototype = NULL;
  blob_prototype = NULL;
}

static ScrDyn *blob_prototype_value(bool file) {
  if (!blob_prototype) {
    ScrDyn *prototype = scr_dyn_new_obj();
    ScrStr *owner = scr_str_new("Blob", 4);
    ScrStr *method = scr_str_new("arrayBuffer", 11);
    ScrDyn *function = scr_dyn_builtin_method(owner, method);
    scr_dyn_obj_set(prototype, "arrayBuffer", 11, function);
    scr_str_release(method);
    scr_str_release(owner);
    blob_prototype = prototype;
    scr_atexit(blob_prototypes_cleanup);
  }
  if (!file) return scr_dyn_retain(blob_prototype);
  if (!file_prototype) {
    file_prototype = scr_dyn_new_obj();
    file_prototype->prototype = scr_dyn_retain(blob_prototype);
  }
  return scr_dyn_retain(file_prototype);
}

static ScrDyn *blob_prototype_named(const ScrStr *name) {
  if (name->len == 4 && !memcmp(name->data, "Blob", 4)) return blob_prototype_value(false);
  if (name->len == 4 && !memcmp(name->data, "File", 4)) return blob_prototype_value(true);
  return NULL;
}

static ScrDyn *blob_prototype_of(const ScrDyn *value) {
  if (value->kind != SCR_DYN_HANDLE) return NULL;
  if (value->v.handle.tag == SCR_DYNH_BLOB) return blob_prototype_value(false);
  if (value->v.handle.tag == SCR_DYNH_FILE) return blob_prototype_value(true);
  return NULL;
}

static bool blob_prototype_invoke(const ScrStr *owner, const ScrStr *method, ScrDyn *receiver,
                                  ScrDyn **result) {
  if (owner->len != 4 || memcmp(owner->data, "Blob", 4) ||
      method->len != 11 || memcmp(method->data, "arrayBuffer", 11)) return false;
  /* The existing reader owns the Blob/File internal-slot check, rejected
   * Promise on a foreign receiver, independent byte copy and microtask turns.
   * It never resolves a property on the supplied receiver. */
  ScrPromise *promise = scr_blob_array_buffer(receiver);
  *result = scr_dyn_new_promise(promise);
  scr_promise_release(promise);
  return true;
}

static const char *blob_prototype_name(const ScrDyn *value) {
  if (!value) return NULL;
  if (value == blob_prototype) return "Blob";
  if (value == file_prototype) return "File";
  return NULL;
}

static bool blob_prototype_fence(const ScrDyn *value, const char *operation) {
  const char *name = blob_prototype_name(value);
  if (!name) return false;
  char message[128];
  int length = snprintf(message, sizeof message, "%s.prototype %s is not supported yet", name, operation);
  scr_throw_error_msg_code(SCR_ERR_ERROR, message, (size_t)length, "SC2020");
  return true;
}

static bool blob_prototype_read_fence(const ScrDyn *value, const char *key, size_t length) {
  if (length == 11 && !memcmp(key, "arrayBuffer", 11)) return false;
  return blob_prototype_fence(value, "member read");
}

static const ScrDynNativePrototypeHooks blob_prototype_hooks = {
    .named = blob_prototype_named,
    .of = blob_prototype_of,
    .invoke = blob_prototype_invoke,
    .fence = blob_prototype_fence,
    .read_fence = blob_prototype_read_fence,
};

__attribute__((constructor)) static void blob_prototype_install(void) {
  scr_dyn_native_prototype_hooks = &blob_prototype_hooks;
}
