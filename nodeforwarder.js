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
	console.log("usage: node nodeforwader.js [HTTP PORT] [SERIAL PORT] [BAUD] [BUFFER LENGTH] [LOG=YES optional]")
	process.exit(1);
}

else
{
	console.log(parts);
	hp = parts[2]
	sp = parts[3]
	baud = parseInt(parts[4])
	blen = parseInt(parts[5])
}

var logfile = false;
if (parts.length == 7) logfile = true;

var bodyParser = require('body-parser');
var app = require('express')();
var fs = require('fs');
var cors = require('cors')
const server = require('http').createServer(app);
var io = require('socket.io')(server);

server.listen(hp);


var sleep = require("sleep").sleep
var SerialPort = require("serialport"); //per ak47 fix
var serialPort = new SerialPort(sp,
	{
  	  baudRate: baud
	});


serialPort.on("open", function () { 
	console.log('open');
    
});  

serialPort.on("close", function () { 
	console.log('closed, reopening');
    	var serialPort = new SerialPort(sp,
	{
  	  baudrate: baud
	});

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
   
   if (logfile) 
   {
       console.log(data.toString('binary')); 
   }
  
   buf += data.toString('binary') 
   lh = new Date().getTime()
   if (buf.length > blen) buf = buf.substr(buf.length-blen,buf.length) 
   io.emit('data', data.toString('utf8'));
   
});

//Enable Cross Site Scripting
app.use(cors())

//Allows us to rip out data?
app.use(bodyParser.urlencoded({extended:true})); //deprecated not sure what to do here....


//Write to serial port
app.get('/write/*',function(req,res){	
	toSend = req.originalUrl.replace("/write/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(new Buffer(toSend))
	res.send(toSend)
});

app.get('/writecf/*',function(req,res){	
	toSend = req.originalUrl.replace("/writecf/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(new Buffer(toSend+"\r\n"))
	res.send(toSend)
});

app.post('/write',function(req,res){	
	x = req.body
	toSend = x
	console.log(toSend)
	
	serialPort.write(new Buffer(toSend['payload']))
	res.send(toSend)
});


//Show Last Updated
app.get('/lastread/',function(req,res){	
	lhs = lh.toString();
	console.log(lhs)
	res.send(lhs)
});


//read buffer
app.get('/read/', function(req, res){
	res.send(buf)
});


//weak interface
app.get('/', function(req, res){
    res.sendFile(__dirname + '/readout.html');
});


app.get('/readout/', function(req, res){
    res.sendFile(__dirname + '/readout.html');
});

//sockets
io.on('connection', function(socket){
  io.emit('data',buf)
  socket.on('input', function(msg){
   //console.log('message: ' + msg);
	serialPort.write(msg+"\r\n")
	
  });
});
