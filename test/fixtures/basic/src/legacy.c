#include <stddef.h>

struct buf {
    char *data;
    size_t len;
};

static size_t buffer_grow(struct buf *b, size_t need) {
    (void)b;
    return need;
}

int buffer_append(struct buf *b, const char *src, size_t n) {
    buffer_grow(b, n);
    (void)src;
    return 0;
}
