# micropython的属性式GPIO控制
# M.py
```python
from machine import Pin 

class M:
    def __init__(self,invert=False):
        self.invert = invert
        self.led1_pin = Pin(32, Pin.OUT)
        self.led2_pin = Pin(33, Pin.OUT)
        self.led3_pin = Pin(25, Pin.OUT)
        self.led4_pin = Pin(26, Pin.OUT)
        self.key1_pin = Pin(35, Pin.IN, Pin.PULL_UP)
        self.key2_pin = Pin(34, Pin.IN, Pin.PULL_UP)



    @property
    def KEY1(self):
        return 1-self.key1_pin.value()

    @property
    def KEY2(self):
        return 1-self.key2_pin.value()

 
    @property
    def LED1(self):
        val = self.led1_pin.value()
        return 1 - val if self.invert else val 
    
    @LED1.setter
    def LED1(self, on_off):
        val = 1 - on_off if self.invert else on_off
        self.led1_pin.value(val)

    @property
    def LED2(self):
        val = self.led2_pin.value()
        return 1 - val if self.invert else val
    
    @LED2.setter
    def LED2(self, on_off):
        val = 1 - on_off if self.invert else on_off
        self.led2_pin.value(val)

    @property
    def LED3(self):
        val = self.led3_pin.value()
        return 1 - val if self.invert else val
    
    @LED3.setter
    def LED3(self, on_off):
        val = 1 - on_off if self.invert else on_off
        self.led3_pin.value(val)

    @property
    def LED4(self):
        val = self.led4_pin.value()
        return 1 - val if self.invert else val
    
    @LED4.setter
    def LED4(self, on_off):
        val = 1 - on_off if self.invert else on_off
        self.led4_pin.value(val)
```

# main.py
```python
from machine import Pin
from utime import sleep
from M import M
m=M();
m.LED1=1
m.LED2=0
m.LED3=1
m.LED4=1
print(11)
```