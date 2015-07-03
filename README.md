#Node Forwarder
A simple serialport to restful interface

##Overview
Serial ports, bless their robust and simple yet legacy bound hearts, are one to one. That is, once a program connects to a serial port, without 1337 skills, only one program can attach to it.  This is not inherently good nor bad, it just is. But in certain contexts, it is a less than helpful limitation.  

This is what nodeforwarder aims to alleviate.  

nodeforwarder connects to your serialport to an http port of your specification, and allows you to read from the serial by points your browser (or better yet cURL like function) to

`http://localhost:PORT/read/`

and you can write by going to 

`http://localhost:PORT/write/YOUR STRING HERE`

or

`http://localhost:PORT/writecf/YOUR STRING HERE`

if you want to append a `\r\n`

Of course, if your computadora is attached to the interwebs, your ports will be accessible to anyone that your firewall allows via `http://YOUR_IP_OR_WHATEVERDOTCOM:PORT/`

This is also not inherently good or bad, it just is.  

##Required Libraries

These come with the repo, but just in case

- serialport -> `npm install serialport`
- express -> `npm install express`
- sleep -> `npm install sleep`
- socket.io -> `npm install socket.io`
- cors -> `npm install cors`

##Quick Run
In the directory where you placed the files run

 `node nodeforwader.js iPORT pPORT SERIALSPEED BUFF`

where
 - iPORT = the internet port (e.g. localhost:8000 would be 8000).  
  - You can make this whatever you want, just make sure there's nothing else trying to run at that port (e.g. pithy, or another forwarder).  If you try to start a forwarder where there's a port in use you'll just get an error, so try another port.  Generally, ports under `1000` are reserved for system use, you can start those but probably have to sudo your way in.  If you don't know what that means don't worry about it

- pPORT = the location of the serial port.  
 - on a linux box this looks like `/dev/ttyUSB*`, where the * is a number in the order the devices were plugged in currently.
 - on a mac this looks like `/dev/tty.usb*` is typically a generated string depending on _what_ USB port you plugged into.  Note that it may not look like `/dev/tty.usb*`, but use your Princeton brain and play with the problem.
 - on a Windows box this will be `COMX`, where X is again the order the device was plugged in on that computer.  Note that this is _persistent_, so if something is `COM4` it is always `COM4` 

- SERIALSPEED = the baud rate for the device on the serial port.  
  - If you coded it yourself in arduino, it's the same as `Serial.begin(SERIALSPEED)`, otherwise it's either settable according to the manufacturer's instructions or fixed.  Good guesses are already `9600` or `57600`.

 - BUFF = the number of characters to buffer from the serial port
  - `10000`  is typically a safe values
  - **NB**: This buffer lets data persist, but it does not tell you whether data is stale or not, e.g. the system can get into places where the serial port device bonks but the forwarder doesn't crash, and when you read data you'll always see the last message passed.  At some point I'll figure out a simple "last message received" check.

phew.  not so quick.  but all you have to write is something like this

`node nodeforwader.js 9000 /dev/ttyUSB0 57600 10000`

##Using the Nodeforwarder

Let's say you chose an iPORT of 9000.  On the computer where you started the forwarder you can browse to that page via 

`http://localhost:9000`.  

When you get there you'll see something like `cannot get /`.  That's fine.  If your device is on the internet, your computer's IP address will replace `localhost`.  If you are the hamachi net, use that IP address when calling it from pithy.

To write data to the serial port simply, in the browser url, type

`http://localhost:9000/write/FOOBAR` 

and `FOOBAR` will be sent to the serial device.  

If you need to send a `\n` with string use

`http://localhost:9000/writecf/FOOBAR` 

To read what comes back, type

`http://localhost:9000/read/` and the current buffer contents will display in the browser.

There is a quick debugging interface at `http://localhost:9000/readout`

##Use in a scripting langauge

Now that the forwarder is set up and you know it's working per above, you can use it in whatever language you want so long as that language can deal with opening and reading from URLs (they _all_ can).  In python this looks like

```python
from urllib import urlopen as uo

site = "http://locahost:9000/"

def write(str):
    return uo(site+"write/"+str).read()

def writecf(str):
    return uo(site+"writecf/"+str).read()

def read():
    return uo(site+"read/").read()

## Your code here.  You'll probably want to write a parser for the return on read

```
`

##Yes
This is [not the first](http://tinyos.stanford.edu/tinyos-wiki/index.php/Mote-PC_serial_communication_and_SerialForwarder_(TOS_2.1.1_and_later)) and it is not the last, but it's mine and it's the only curl baed system that _I_ know of.  So please use it and enjoy it and don't tell me it's not original.  I know it's not, but it works.
