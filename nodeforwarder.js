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
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const sqlite3 = require('sqlite3').verbose();

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
		
		// Handle logging if active
		if (loggingState.isLogging) {
			const dataString = data.toString('utf8').trim();
			if (dataString) {
				handleDataLogging(dataString);
			}
		}
		
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

// Logging state management
let loggingState = {
  isLogging: false,
  type: null, // 'csv' or 'sqlite'
  filename: null,
  tableName: null,
  columns: [],
  schemaDetected: false,
  csvWriter: null,
  db: null,
  insertStmt: null
};

// Helper function to detect schema from first data row
function detectSchema(dataString) {
  try {
    const data = JSON.parse(dataString);
    if (Array.isArray(data)) {
      return data.map((_, index) => `col_${String(index + 1).padStart(2, '0')}`);
    } else if (typeof data === 'object') {
      return Object.keys(data);
    }
  } catch (e) {
    // If not JSON, try to split by common delimiters
    const parts = dataString.trim().split(/[,\t|;]/);
    return parts.map((_, index) => `col_${String(index + 1).padStart(2, '0')}`);
  }
  return ['col_01']; // Fallback for single value
}

// Helper function to parse incoming data into object
function parseDataToObject(dataString, columns) {
  try {
    const data = JSON.parse(dataString);
    if (Array.isArray(data)) {
      const obj = {};
      data.forEach((value, index) => {
        if (index < columns.length) {
          obj[columns[index]] = value;
        }
      });
      return obj;
    } else if (typeof data === 'object') {
      return data;
    }
  } catch (e) {
    // If not JSON, try to split by common delimiters
    const parts = dataString.trim().split(/[,\t|;]/);
    const obj = {};
    parts.forEach((value, index) => {
      if (index < columns.length) {
        obj[columns[index]] = value.trim();
      }
    });
    return obj;
  }
  // Single value fallback
  return { [columns[0]]: dataString.trim() };
}

// Handle data logging to CSV or SQLite
function handleDataLogging(dataString) {
  try {
    // Clean up the data string - remove line breaks and extra whitespace
    const cleanedData = dataString.replace(/[\r\n]+/g, '').trim();
    
    // Skip empty or invalid data
    if (!cleanedData) return;
    
    // Detect schema from first data row if not already detected
    if (!loggingState.schemaDetected) {
      if (loggingState.columns.length === 0) {
        loggingState.columns = detectSchema(cleanedData);
      }
      
      if (loggingState.type === 'csv') {
        initializeCsvLogging();
      } else if (loggingState.type === 'sqlite') {
        initializeSqliteLogging();
      }
      
      loggingState.schemaDetected = true;
    }
    
    // Parse data and log it
    const dataObj = parseDataToObject(cleanedData, loggingState.columns);
    
    if (loggingState.type === 'csv' && loggingState.csvWriter) {
      loggingState.csvWriter.writeRecords([dataObj]).catch(err => {
        console.error('CSV write error:', err);
      });
    } else if (loggingState.type === 'sqlite' && loggingState.insertStmt) {
      const values = loggingState.columns.map(col => dataObj[col] || null);
      loggingState.insertStmt.run(values, (err) => {
        if (err) console.error('SQLite insert error:', err);
      });
    }
  } catch (error) {
    console.error('Data logging error:', error);
  }
}

// Initialize CSV logging
function initializeCsvLogging() {
  const csvHeaders = loggingState.columns.map(col => ({ id: col, title: col }));
  
  loggingState.csvWriter = createCsvWriter({
    path: loggingState.filename,
    header: csvHeaders,
    append: fs.existsSync(loggingState.filename)
  });
}

// Initialize SQLite logging
function initializeSqliteLogging() {
  loggingState.db = new sqlite3.Database(loggingState.filename);
  
  // Create table if it doesn't exist
  const columnDefs = loggingState.columns.map(col => `${col} TEXT`).join(', ');
  const createTableQuery = `CREATE TABLE IF NOT EXISTS ${loggingState.tableName} (${columnDefs})`;
  
  loggingState.db.run(createTableQuery, (err) => {
    if (err) {
      console.error('SQLite table creation error:', err);
      return;
    }
    
    // Prepare insert statement
    const placeholders = loggingState.columns.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO ${loggingState.tableName} (${loggingState.columns.join(', ')}) VALUES (${placeholders})`;
    
    loggingState.insertStmt = loggingState.db.prepare(insertQuery);
  });
}


//Enable Cross Site Scripting
app.use(cors())
app.use('/static',express.static(__dirname + '/static'))

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
    res.sendFile(__dirname + '/console.html');
});


app.get('/console', function(req, res){
    res.sendFile(__dirname + '/console.html');
});

// Start CSV logging
app.post('/start_csv_log', function(req, res) {
  try {
    const { filename, columns } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    // Stop any current logging
    stopLogging();
    
    // Initialize CSV logging state
    loggingState.isLogging = true;
    loggingState.type = 'csv';
    loggingState.filename = filename;
    loggingState.columns = columns || [];
    loggingState.schemaDetected = false;
    loggingState.csvWriter = null;
    
    console.log(`Started CSV logging to: ${filename}`);
    res.json({ 
      success: true, 
      message: `CSV logging started to ${filename}`,
      columns: loggingState.columns 
    });
  } catch (error) {
    console.error('Error starting CSV logging:', error);
    res.status(500).json({ error: 'Failed to start CSV logging' });
  }
});

// Start SQLite logging
app.post('/start_sqlite_log', function(req, res) {
  try {
    const { filename, table, columns } = req.body;
    
    if (!filename || !table) {
      return res.status(400).json({ error: 'Filename and table name are required' });
    }
    
    // Stop any current logging
    stopLogging();
    
    // Initialize SQLite logging state
    loggingState.isLogging = true;
    loggingState.type = 'sqlite';
    loggingState.filename = filename;
    loggingState.tableName = table;
    loggingState.columns = columns || [];
    loggingState.schemaDetected = false;
    loggingState.db = null;
    loggingState.insertStmt = null;
    
    console.log(`Started SQLite logging to: ${filename}, table: ${table}`);
    res.json({ 
      success: true, 
      message: `SQLite logging started to ${filename}, table: ${table}`,
      columns: loggingState.columns 
    });
  } catch (error) {
    console.error('Error starting SQLite logging:', error);
    res.status(500).json({ error: 'Failed to start SQLite logging' });
  }
});

// Stop logging
app.post('/stop_log', function(req, res) {
  try {
    stopLogging();
    res.json({ success: true, message: 'Logging stopped' });
  } catch (error) {
    console.error('Error stopping logging:', error);
    res.status(500).json({ error: 'Failed to stop logging' });
  }
});

// Get logging status
app.get('/log_status', function(req, res) {
  res.json({
    isLogging: loggingState.isLogging,
    type: loggingState.type,
    filename: loggingState.filename,
    tableName: loggingState.tableName,
    columns: loggingState.columns,
    schemaDetected: loggingState.schemaDetected
  });
});

// Helper function to stop logging and clean up resources
function stopLogging() {
  if (loggingState.insertStmt) {
    loggingState.insertStmt.finalize();
    loggingState.insertStmt = null;
  }
  
  if (loggingState.db) {
    loggingState.db.close();
    loggingState.db = null;
  }
  
  loggingState.isLogging = false;
  loggingState.type = null;
  loggingState.filename = null;
  loggingState.tableName = null;
  loggingState.columns = [];
  loggingState.schemaDetected = false;
  loggingState.csvWriter = null;
  
  console.log('Logging stopped and resources cleaned up');
}

//sockets
io.on('connection', function(socket){
  io.emit('data',buf)
  socket.on('input', function(msg){
   //console.log('message: ' + msg);
	serialPort.write(msg+"\r\n")
	
  });
});
