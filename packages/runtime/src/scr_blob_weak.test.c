#include "scr_runtime.h"
#include <assert.h>
#include <stdio.h>

static ScrDyn *call(ScrDyn *owner, const char *method, ScrDyn *const *args, size_t count) {
  ScrDyn *result = scr_dyn_handle_ops_of(owner)->invoke(owner->v.handle.ptr, owner, method, args, count, method);
  assert(result && !scr_exc_pending());
  return result;
}

static void put(ScrDyn *map, ScrDyn *key, ScrDyn *value) {
  ScrDyn *args[] = { key, value };
  ScrDyn *result = call(map, "set", args, 2);
  assert(result == map);
  scr_dyn_release(result);
}

static bool probe(ScrDyn *owner, const char *method, ScrDyn *key) {
  ScrDyn *result = call(owner, method, &key, 1);
  assert(result->kind == SCR_DYN_BOOL);
  bool answer = result->v.b;
  scr_dyn_release(result);
  return answer;
}

static ScrDyn *blob(bool file) {
  ScrDyn *args = scr_dyn_new_arr();
  ScrDyn *parts = scr_dyn_new_arr();
  ScrStr *text = scr_str_new("payload", 7);
  scr_dyn_arr_push(parts, scr_dyn_new_str(text));
  scr_str_release(text);
  scr_dyn_arr_push(args, parts);
  if (file) {
    ScrStr *name = scr_str_new("file", 4);
    scr_dyn_arr_push(args, scr_dyn_new_str(name));
    scr_str_release(name);
  }
  ScrDyn *key = file ? scr_file_new(args) : scr_blob_new(args);
  scr_dyn_release(args);
  assert(key && !scr_exc_pending());
  return key;
}

static ScrDyn *nothing(ScrClosure *closure, ScrDyn *const *args, size_t argc) {
  (void)closure; (void)args; (void)argc;
  return scr_dyn_retain(scr_dyn_undefined());
}

static void lifetime(bool file) {
  ScrDyn *map = scr_weak_map_new(scr_dyn_undefined());
  ScrDyn *other = scr_weak_map_new(scr_dyn_undefined());
  ScrDyn *set = scr_weak_set_new(scr_dyn_undefined());
  ScrDyn *first = scr_dyn_new_obj(), *second = scr_dyn_new_obj();
  ScrDyn *key = blob(file);
  // A second box observes the same native referent and its original tag.
  ScrDyn *alias = scr_dyn_new_handle(key->v.handle.ptr, key->v.handle.tag);
  put(map, key, first);
  assert(first->rc == 2);
  ScrDyn *got = call(map, "get", &alias, 1);
  assert(got == first);
  scr_dyn_release(got);
  put(map, alias, second);
  assert(first->rc == 1 && second->rc == 2);
  put(other, alias, first);
  ScrDyn *added = call(set, "add", &key, 1);
  scr_dyn_release(added);
  scr_dyn_release(key);
  assert(first->rc == 2 && second->rc == 2 && probe(set, "has", alias));

  ScrDyn *empty = scr_dyn_new_arr();
  ScrDyn *slice = scr_blob_slice(alias, empty);
  scr_dyn_release(empty);
  assert(slice && !scr_exc_pending() && slice->v.handle.ptr != alias->v.handle.ptr);
  assert(!probe(map, "has", slice));
  assert(probe(map, "delete", alias) && !probe(map, "delete", alias));
  assert(second->rc == 1);
  put(map, alias, second);
  scr_dyn_release(alias);
  // The weak collections kept no native key alive; disposal dropped both
  // maps' values even though the collections themselves remain alive.
  assert(first->rc == 1 && second->rc == 1);
  scr_dyn_release(slice); // sharing the byte store never retains the old key
  scr_dyn_release(other);
  scr_dyn_release(set);

  for (unsigned i = 0; i < 2048; i++) {
    key = blob(i % 2 != 0);
    assert(!probe(map, "has", key));
    put(map, key, first);
    assert(first->rc == 2);
    scr_dyn_release(key);
    assert(first->rc == 1); // entry removed before the address can be reused
  }

  // Retiring the owner first releases its value without retaining the key.
  key = blob(file);
  put(map, key, first);
  scr_dyn_release(map);
  assert(first->rc == 1);
  ScrDyn *size = scr_dyn_handle_ops_of(key)->get(key->v.handle.ptr, "size", 4);
  assert(size && size->kind == SCR_DYN_NUM && size->v.num == 7);
  scr_dyn_release(size);

  // Registry targets and unregister tokens remain weak too. Its existing
  // no-cleanup-callback policy is unchanged by this admission.
  ScrDyn *callback = scr_dyn_new_func(scr_closure_new(NULL, 0), nothing, 1, "", "cleanup");
  ScrDyn *registry = scr_finalization_registry_new(callback);
  scr_dyn_release(callback);
  map = scr_weak_map_new(scr_dyn_undefined());
  put(map, key, first);
  ScrDyn *registration[] = { key, second, key };
  ScrDyn *registered = call(registry, "register", registration, 3);
  scr_dyn_release(registered);
  scr_dyn_release(key);
  assert(first->rc == 1 && second->rc == 1);
  key = blob(file);
  assert(!probe(registry, "unregister", key));
  scr_dyn_release(key);
  scr_dyn_release(registry);
  scr_dyn_release(map);
  scr_dyn_release(first);
  scr_dyn_release(second);
}

int main(void) {
  lifetime(false);
  lifetime(true);
  assert(!scr_exc_pending());
  puts("Blob and File weak keys preserve identity and retire metadata");
  return 0;
}
