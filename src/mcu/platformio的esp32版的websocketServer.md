# platformio.ini
```bash
[platformio]
src_dir = ./

[env:pico32]
platform = espressif32
board = pico32
framework = arduino

monitor_speed = 115200
monitor_port =COM11
upload_port = COM11
upload_speed = 921600

; 库依赖，添加 WebSockets 库
; 库依赖，这里我们需要使用 ESPAsyncWebServer 库
lib_deps =
    me-no-dev/ESPAsyncWebServer@^1.2.3


build_flags =
    -Ilib
    -Irtt
    -Isrc
    -Isrc/app
    -Isrc/user
    -Isrc/bsp
    -Isrc/common
    -Isrc/utils
    -MMD -MP

build_src_filter = +<src/> +<src/utils> +<src/common> +<src/app/> +<src/bsp/>  +<src/user/>  +<lib/> +<rtt/>


```

# main.cpp
```c
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>

// WiFi settings
const char* ssid = "ming1";
const char* password = "panzer";

// Create AsyncWebServer instance on port 80
AsyncWebServer server(80);

// Create AsyncWebSocket instance
AsyncWebSocket ws("/ws");

// Client count
int connectedClients = 0;

// HTML page
const char HTML[] PROGMEM = R"=====(<html>
  <head>
    <title>ESP32 WebSocket Test</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: Arial; text-align: center; margin: 0; padding: 30px; }
      h1 { color: #333; }
      button { padding: 10px 20px; margin: 10px; cursor: pointer; }
      #status { margin-top: 20px; font-weight: bold; }
      #messages { margin-top: 20px; text-align: left; border: 1px solid #ccc; padding: 10px; min-height: 200px; }
    </style>
  </head>
  <body>
    <h1>ESP32 WebSocket Test</h1>
    <button onclick="connectWS()">Connect WebSocket</button>
    <button onclick="disconnectWS()">Disconnect</button>
    <button onclick="sendMessage()">Send Test Message</button>
    <div id="status">Disconnected</div>
    <div id="messages"></div>

    <script>
      let socket = null;
      let statusDiv = document.getElementById('status');
      let messagesDiv = document.getElementById('messages');

      function logMessage(message) {
        messagesDiv.innerHTML += message + '<br>';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }

      function connectWS() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = wsProtocol + '//' + window.location.hostname + '/ws';

        socket = new WebSocket(wsUrl);

        socket.onopen = function() {
          statusDiv.textContent = 'Connected';
          statusDiv.style.color = 'green';
          logMessage('WebSocket connection established');
        };

        socket.onmessage = function(event) {
          logMessage('Received: ' + event.data);
        };

        socket.onclose = function() {
          statusDiv.textContent = 'Disconnected';
          statusDiv.style.color = 'red';
          logMessage('WebSocket connection closed');
        };

        socket.onerror = function(error) {
          logMessage('Error: ' + error);
        };
      }

      function disconnectWS() {
        if (socket) {
          socket.close();
          socket = null;
        }
      }

      function sendMessage() {
        if (socket && socket.readyState === WebSocket.OPEN) {
          const message = 'Hello from browser at ' + new Date().toLocaleTimeString();
          socket.send(message);
          logMessage('Sent: ' + message);
        } else {
          logMessage('Cannot send message: Not connected');
        }
      }

      // Auto connect
      window.onload = function() {
        setTimeout(connectWS, 1000);
      };
    </script>
  </body>
</html>)=====";

// WebSocket event handler
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
               AwsEventType type, void *arg, uint8_t *data, size_t len) {

    switch (type) {
        case WS_EVT_CONNECT: {
            Serial.printf("WebSocket client #%u connected, IP: %s\n", client->id(), client->remoteIP().toString().c_str());
            connectedClients++;

            // Send welcome message to new client
            client->text("Welcome to ESP32 WebSocket Server!");

            // Broadcast client count update to all clients
            char msg[64];
            sprintf(msg, "Client count: %d", connectedClients);
            ws.textAll(msg);
            break;
        }

        case WS_EVT_DISCONNECT: {
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            connectedClients--;

            // Broadcast client count update to all clients
            char msg[64];
            sprintf(msg, "Client count: %d", connectedClients);
            ws.textAll(msg);
            break;
        }

        case WS_EVT_DATA: {
            AwsFrameInfo *info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                // Ensure data is null-terminated
                data[len] = 0;
                Serial.printf("Client #%u sent: %s\n", client->id(), (char*)data);

                // Echo message back to sender
                client->text((char*)data);
            }
            break;
        }

        case WS_EVT_ERROR: {
            Serial.printf("WebSocket error #%u\n", client->id());
            break;
        }

        case WS_EVT_PONG: {
            Serial.printf("Pong response received from client #%u\n", client->id());
            break;
        }
    }
}

// Send periodic messages to all clients
void sendPeriodicMessages() {
    static unsigned long lastSendTime = 0;
    if (millis() - lastSendTime > 10000) {  // Every 10 seconds
        lastSendTime = millis();
        if (connectedClients > 0) {
            char msg[64];
            sprintf(msg, "Server heartbeat: %lu", millis());
            ws.textAll(msg);
           // ws.binaryAll( msg, strlen(msg));
            Serial.println("Heartbeat message sent");
        }
    }
}

void setup() {
    Serial.begin(115200);
    Serial.println("ESP32 WebSocket Server starting...");

    // Connect to WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi...");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.print("Connected, IP address: ");
    Serial.println(WiFi.localIP());

    // Set up WebSocket callback
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    // Configure HTTP server routes
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send_P(200, "text/html", HTML);
    });

    server.onNotFound([](AsyncWebServerRequest *request){
        request->send(404, "text/plain", "Page not found");
    });

    // Start server
    server.begin();
    Serial.println("Async Web Server and WebSocket service started");
}

void loop() {
    // Periodically clean up inactive WebSocket clients
    ws.cleanupClients();

    // Send periodic messages
    sendPeriodicMessages();

    // Additional tasks can be added here without blocking

    // Small delay to prevent high CPU usage
    delay(1);
}
```