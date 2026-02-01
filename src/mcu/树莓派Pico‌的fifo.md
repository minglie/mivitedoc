
# 定长元素队列
```c
/**
 * 中段写g_queue,主循环读g_queue
 */

#include <stdio.h>
#include "pico/stdlib.h"
#include "pico/util/queue.h"
#include "hardware/timer.h"

queue_t g_queue;
// 定时器回调（中断上下文）
bool timer_cb(repeating_timer_t *t) {
    static int sec = 0;
    bool ret =queue_try_add(&g_queue, &sec);
    if(!ret){
        printf("queue is full\n");
    }
    sec++;
    return true;
}

int main() {
    stdio_init_all();
    queue_init(&g_queue, sizeof(int), 8);
    static repeating_timer_t timer;
    add_repeating_timer_ms(
            1000,        // 1s
            timer_cb,
            NULL,
            &timer
    );

    while (true) {
        int v;
        if (queue_try_remove(&g_queue, &v)) {
            printf("main got: %d\n", v);
        }
        sleep_ms(1000);
        // 主循环干别的事
        tight_loop_contents();
    }
}

```