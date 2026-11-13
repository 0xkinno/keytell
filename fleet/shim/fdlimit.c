// Test-only shim for containers without CAP_SYS_RESOURCE: the NEAR sandbox node insists on
// raising its open-file limit to 65535 and exits if it cannot. This makes that call report
// success for RLIMIT_NOFILE so local sandbox tests can run. Never used in deployment.
#define _GNU_SOURCE
#include <dlfcn.h>
#define RLIMIT_NOFILE_ 7
struct rl { unsigned long cur, max; };
typedef int (*set_t)(int, const struct rl *);
typedef int (*pr_t)(int, int, const struct rl *, struct rl *);
static int fake(int r) { return r == RLIMIT_NOFILE_; }
int setrlimit(int r, const struct rl *l) { if (fake(r)) return 0; return ((set_t)dlsym(RTLD_NEXT, "setrlimit"))(r, l); }
int setrlimit64(int r, const struct rl *l) { if (fake(r)) return 0; return ((set_t)dlsym(RTLD_NEXT, "setrlimit64"))(r, l); }
int prlimit(int p, int r, const struct rl *n, struct rl *o) {
  pr_t real = (pr_t)dlsym(RTLD_NEXT, "prlimit");
  if (fake(r) && n) { if (o) real(p, r, 0, o); return 0; }
  return real(p, r, n, o);
}
int prlimit64(int p, int r, const struct rl *n, struct rl *o) {
  pr_t real = (pr_t)dlsym(RTLD_NEXT, "prlimit64");
  if (fake(r) && n) { if (o) real(p, r, 0, o); return 0; }
  return real(p, r, n, o);
}
