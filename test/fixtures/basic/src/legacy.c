#include <stddef.h>

struct buffer {
    char *data;
    size_t len;
};

static size_t buffer_grow(struct buffer *buf, size_t need) {
    (void)buf;
    return need;
}

int buffer_append(struct buffer *buf, const char *src, size_t n) {
    buffer_grow(buf, n);
    (void)src;
    return 0;
}
