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

TODO as of 2021-10-16:

[x] Update Parser and buffer handling
[x] POST calls
[x] check working with python-socketio (big yes!)
[ ] Add parsing options to inteface?


*/

parts = process.argv

if (parts.length < 2)
{
	console.log("usage: node nodeforwader.js [HTTP PORT] [SERIAL PORT (optional)] [BAUD (optional)] [BUFFER LENGTH (optional)]")
	process.exit(1);
}

else
{
	console.log(parts);
	hp = parts[2]
	try{sp = parts[3]}             catch(e){sp = undefined} 
	try{baud = parseInt(parts[4])} catch(e){baud = undefined}
	try{blen = parseInt(parts[5])} catch(e){blen = 10000}
}


var bodyParser = require('body-parser');
var express = require('express')
var app = express();
var fs = require('fs');
var cors = require('cors')
const server = require('http').createServer(app);
var io = require('socket.io')(server,{cors:{methods: ["GET", "POST"]}});

const SerialPort = require('serialport');

server.listen(hp);

function msleep(n) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
  }
  function sleep(n) {
	msleep(n*1000);
  }

  var lh = 0;



  let serialPort;
  let currentPath = '/dev/tty-usbserial1'; // Default path
  
  function initializeSerialPort(path,baud) {
	  if (serialPort && serialPort.isOpen) {
		  console.log('Closing current serial port...');
		  serialPort.close((err) => {
			  if (err) {
				  console.error('Error closing serial port:', err.message);
			  } else {
				  console.log('Serial port closed successfully.');
				  createNewPort(path,baud);
			  }
		  });
	  } else {
		  createNewPort(path,baud);
	  }
  }
  
  function createNewPort(path,baud) {
	  console.log(`Initializing serial port with path: ${path}`);
	  serialPort = new SerialPort(path, { baudRate: baud });
  
	  // Attach event listeners
	  serialPort.on('open', () => {
		  console.log('Serial port opened:', path);
	  });
  
		//last heard
		serialPort.on('data', function(data) {
		
		
		buf += data.toString('binary') 
		lh = new Date().getTime()
		if (buf.length > blen) buf = buf.substr(buf.length-blen,buf.length) 
		io.emit('data', data.toString('utf8'));
		
		});
  
	  serialPort.on('error', (err) => {
		  console.error('Serial port error:', err.message);
	  });
  
	  serialPort.on('close', () => {
		  console.log('Serial port closed');
	  });
  
	  currentPath = path; // Update the current path
  }
  
  // API to change the path dynamically
  function changeSerialPortPath(newPath) {
	  console.log(`Changing serial port path from ${currentPath} to ${newPath}`);
	  initializeSerialPort(newPath);
  }
  


if (sp != undefined) initializeSerialPort(sp,baud)

//On Data fill a circular buf of the specified length
buf = ""


//Enable Cross Site Scripting
app.use(cors())
app.use('/static',express.static('static'))

//Allows us to rip out data
app.use(bodyParser.urlencoded({extended:true})); //post forms
app.use(bodyParser.json()) // json forms (e.g. axios)
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For URL-encoded data, if necessary

//Write to serial port
app.get('/write/*',function(req,res){	
	toSend = req.originalUrl.replace("/write/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend)
	res.send(toSend)
});

massage = undefined

  // Attempt to reconnect the serial port
app.get('/reconnect', async (req, res) => {initializeSerialPort(sp,baud); res.send("foo") });

app.get('/disconnect', async (req, res) => {try{serialPort.close()} catch(e){console.log(e)}; res.send("foo")});

app.post('/reconnect',async (req, res) => {x=req.body;initializeSerialPort(x['sp'],parseInt(['baud'])); res.send("foo") })
  
app.get("/list_ports", async(req,res)=>{res.send(await SerialPort.list())});

app.get('/writecf/*',function(req,res){	
	toSend = req.originalUrl.replace("/writecf/","")
	toSend = decodeURIComponent(toSend);
	console.log(toSend)
	serialPort.write(toSend+"\r\n")
	res.send(toSend)
});

//#expects data to be in {'payload':data} format
app.post('/write',function(req,res){    
	x = req.body
	toSend = x['payload']
	console.log(toSend)
	serialPort.write(toSend)
	res.send(toSend)
});


app.get("/connect",(req,res)=>{

	res.sendFile(__dirname + '/connect.html');

})

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
