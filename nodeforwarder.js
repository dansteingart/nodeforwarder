/* 
NodeForwader: an serial to http proxy driven by ghetto get calls
requirements 
   -- serialport -> npm install serialport
   -- express -> npm install express
   -- sleep -> npm install sleep
   -- socket.io -> npm install socket.io
   -- cors -> npm install cors

to start: node nodeforwader.js [HTTP PORT] [SERIAL PORT] [BAUD] [BUFFER LENGTH]
to read: http://[yourip]:[spec'd port]/read/  -> returns the last [BUFFER LENGTH] bytes from the serial port as a string
to write: http://[yourip]:[spec'd port]/write/[YOUR STRING HERE]

what will probably create farts/list of things to deal with later if I need to:
- returning characters that html has issues with
- spaces in the url

*/

parts = process.argv

if (parts.length < 6)
{
	console.log("usage: node nodeforwader.js [HTTP PORT] [SERIAL PORT] [BAUD] [BUFFER LENGTH]")
	process.exit(1);
}

else
{
	console.log(parts);
	hp = parts[2]
	sp = parts[3]
	baud = parseInt(parts[4])
	blen = 10000
}

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cors = require('cors')
http.listen(hp);

var sleep = require("sleep").sleep
var SerialPort = require("serialport").SerialPort ;
var serialPort = new SerialPort(sp,
	{
  	  baudrate: baud
	});


serialPort.on("open", function () { 
	console.log('open');
    
});  

//sleep for 5 seconds for arduino serialport purposes
for (var i=0; i<3; i++ )
{
	console.log(i);
	sleep(1); 
}


//On Data fill a circular buf of the specified length
buf = ""

//last heard
var lh = 0;
serialPort.on('data', function(data) {
	//console.log(data);
   buf += data	   
   lh = new Date().getTime()
   if (buf.length > blen) buf = buf.substr(buf.length-blen,buf.length) 
   io.emit('data', data);
   
});

//Write to serial port
app.use(cors())
app.get('/write/*',function(req,res){	
	toSend = req.originalUrl.replace("/write/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend)
	res.send(toSend)
});

//Write to serial port
app.get('/writecf/*',function(req,res){	
	toSend = req.originalUrl.replace("/writecf/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend+"\r\n")
	res.send(toSend)
});

//Show Last Updated
app.get('/lastread/',function(req,res){	
	console.log(lh)
	res.send(lh)
});



//read buffer
app.get('/read/', function(req, res){
	res.send(buf)
});


app.get('/readout/', function(req, res){
	//console.log(buf)
    res.sendFile(__dirname + '/readout.html');
});

io.on('connection', function(socket){
  io.emit('data',buf)
  socket.on('input', function(msg){
   //console.log('message: ' + msg);
	serialPort.write(msg+"\r\n")
	
  });
});
