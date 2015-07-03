#Node Forwarder
A simple serialport to restful interface

##Overview
Serial ports, bless their robust and simple yet legacy bound hearts, are one to one. That is, once a program connects to a serial port, without 1337 skills, only one program can attach to it.  This is not inherently good nor bad, it just is. But in certain contexts, it is a less than helpful limitation.  

This is what nodefowarder aims to alleviate.  

nodefowarder connects to your serialport to an http port of your specification, and allows you to read from the serial by points your browser (or better yet cURL like function) to

`http://localhost:PORT/read/`

and you can write by going to 

`http://localhost:PORT/write/YOUR STRING HERE`

or

`http://localhost:PORT/writecf/YOUR STRING HERE`

if you want to append a `\r\n`

Of course, if your computadora is attached to the interweb, your ports will be accesible to anyone that your firewall allows via `http://YOUR_IP_OR_WHATEVERDOTCOM:PORT/`

This is also not inherently good or bad, it just is.  

##Required Libraries
- serialport -> `npm install serialport`
- express -> `npm install express`
- sleep -> `npm install sleep`
- socket.io -> `npm install socket.io`
- cors -> `npm install cors`

`

##Yes
this is [not the first](http://tinyos.stanford.edu/tinyos-wiki/index.php/Mote-PC_serial_communication_and_SerialForwarder_(TOS_2.1.1_and_later)) and it is not the last, but it's mine and it's the only curl baed system that _I_ know of.  So please use it and enjoy it and don't tell me it's not original.  I know it's not, but it works.
