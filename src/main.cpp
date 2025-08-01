#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <SPIFFS.h>
#include <DNSServer.h>
#include <ArduinoJson.h>
#include <vector>
#include <map>
#include "Config.h"
#include "Sensor.h"
#include "Actuator.h"
#include "StatusLED.h"

// Global objects
WebServer server(80);
DNSServer dnsServer;
Config config;

// Device containers
std::vector<BaseSensor*> sensors;
std::vector<BaseActuator*> actuators;

// Status LED (pins RGB)
StatusLED statusLED(25, 26, 27); // Rouge=25, Vert=26, Bleu=27

// System state
bool authenticated = false;
String currentUser = "";
unsigned long lastSensorRead = 0;
const unsigned long sensorReadInterval = 1000;

// Function prototypes
void initWiFi();
void initSPIFFS();
void initDevices();
void initWebServer();
void handleRoot();
void handleLogin();
void handleAPI();
void handleDevices();
void handleSensorData();
void handleActuatorControl();
void handleConfig();
void handleSystemStats();
void handleNotFound();
void updateSensors();
void processRules();
void updateStatusLED();
void evaluateRule(const RuleConfig& rule);
bool evaluateConditions(const std::vector<Condition>& conditions, const std::map<String, SensorReading>& readings);
bool evaluateSchedule(const Schedule& schedule);
void executeActions(const std::vector<Action>& actions);
String getContentType(String filename);
bool checkAuthentication();

// Sensor readings storage
std::map<String, SensorReading> latestReadings;

void setup() {
  Serial.begin(115200);
  Serial.println("OPENDOM System Starting...");
  
  // Initialize SPIFFS
  initSPIFFS();
  
  // Load configuration
  if (!config.loadFromFile("/configuration.json")) {
    Serial.println("Failed to load configuration!");
    return;
  }
  config.printConfig();
  
  // Initialize devices
  initDevices();
  
  // Initialize status LED
  statusLED.init();
  
  // Initialize WiFi
  initWiFi();
  
  // Initialize web server
  initWebServer();
  
  Serial.println("OPENDOM System Ready!");
  Serial.println("Connect to WiFi: " + config.system.wifi.ssid);
  Serial.println("Password: " + config.system.wifi.password);
  Serial.println("Access interface at: http://192.168.4.1");
}

void loop() {
  // Handle DNS requests (captive portal)
  dnsServer.processNextRequest();
  
  // Handle web server requests
  server.handleClient();
  
  // Update sensors
  updateSensors();
  
  // Process automation rules
  processRules();
  
  // Update status LED
  updateStatusLED();
  statusLED.update();
  
  // Update actuators (for timed operations)
  for (auto* actuator : actuators) {
    RelayActuator* relay = static_cast<RelayActuator*>(actuator);
    BuzzerActuator* buzzer = static_cast<BuzzerActuator*>(actuator);
    
    // Check actuator type and update accordingly
    for (const auto& deviceConfig : config.devices) {
      if (deviceConfig.id == actuator->getId()) {
        if (deviceConfig.actuatorType == "RELAY") {
          relay = static_cast<RelayActuator*>(actuator);
          relay->update();
        } else if (deviceConfig.actuatorType == "BUZZER") {
          buzzer = static_cast<BuzzerActuator*>(actuator);
          buzzer->update();
        }
        break;
      }
    }
  }
  
  delay(10);
}

void initSPIFFS() {
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS initialization failed!");
    return;
  }
  Serial.println("SPIFFS initialized successfully");
}

void initWiFi() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(config.system.wifi.ssid.c_str(), config.system.wifi.password.c_str());
  
  IPAddress IP = WiFi.softAPIP();
  Serial.println("WiFi AP started");
  Serial.print("IP address: ");
  Serial.println(IP);
  
  // Start DNS server for captive portal
  if (config.system.captivePortal) {
    dnsServer.start(53, "*", IP);
    Serial.println("Captive portal DNS started");
  }
}

void initDevices() {
  Serial.println("Initializing devices...");
  
  // Initialize sensors
  for (const auto& deviceConfig : config.devices) {
    if (deviceConfig.type == "sensor" && deviceConfig.enabled) {
      BaseSensor* sensor = nullptr;
      
      if (deviceConfig.sensorType == "DHT11") {
        sensor = new DHT11Sensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.sensorType == "MQ2") {
        sensor = new MQ2Sensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.sensorType == "ASC") {
        sensor = new ASCSensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.sensorType == "LDR") {
        sensor = new LDRSensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.sensorType == "PIR") {
        sensor = new PIRSensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.sensorType == "BUTTON") {
        sensor = new ButtonSensor(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      }
      
      if (sensor) {
        sensor->setReadInterval(deviceConfig.readInterval);
        sensor->init();
        sensors.push_back(sensor);
      }
    }
    
    // Initialize actuators
    if (deviceConfig.type == "actuator" && deviceConfig.enabled) {
      BaseActuator* actuator = nullptr;
      
      if (deviceConfig.actuatorType == "RELAY") {
        actuator = new RelayActuator(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      } else if (deviceConfig.actuatorType == "BUZZER") {
        actuator = new BuzzerActuator(deviceConfig.id, deviceConfig.name, deviceConfig.pin);
      }
      
      if (actuator) {
        actuator->init();
        actuator->setState(deviceConfig.state);
        actuators.push_back(actuator);
      }
    }
  }
  
  Serial.println("Devices initialized: " + String(sensors.size()) + " sensors, " + String(actuators.size()) + " actuators");
}

void initWebServer() {
  // Serve static files
  server.on("/", handleRoot);
  server.on("/login", HTTP_POST, handleLogin);
  server.on("/api/sensors", HTTP_GET, handleSensorData);
  server.on("/api/actuators", HTTP_POST, handleActuatorControl);
  server.on("/api/config", HTTP_GET, handleConfig);
  server.on("/api/config", HTTP_POST, handleConfig);
  server.on("/api/system", HTTP_GET, handleSystemStats);
  
  // Serve static files
  server.onNotFound(handleNotFound);
  
  server.begin();
  Serial.println("Web server started");
}

void handleRoot() {
  File file = SPIFFS.open("/index.html", "r");
  if (file) {
    server.streamFile(file, "text/html");
    file.close();
  } else {
    server.send(404, "text/plain", "File not found");
  }
}

void handleLogin() {
  if (server.hasArg("username") && server.hasArg("password")) {
    String username = server.arg("username");
    String password = server.arg("password");
    
    if (username == config.system.auth.username && password == config.system.auth.password) {
      authenticated = true;
      currentUser = username;
      server.send(200, "application/json", "{\"success\":true,\"user\":\"" + username + "\"}");
    } else {
      server.send(401, "application/json", "{\"success\":false,\"error\":\"Invalid credentials\"}");
    }
  } else {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing credentials\"}");
  }
}

void handleSensorData() {
  if (!checkAuthentication()) return;
  
  JsonDocument doc;
  JsonArray sensorsArray = doc["sensors"].to<JsonArray>();
  
  for (const auto& reading : latestReadings) {
    // Ne inclure que les lectures valides dans l'API
    if (reading.second.isValid) {
      JsonObject sensorObj = sensorsArray.add<JsonObject>();
      sensorObj["id"] = reading.second.sensorId;
      sensorObj["type"] = reading.second.type;
      sensorObj["timestamp"] = reading.second.timestamp;
      sensorObj["isValid"] = reading.second.isValid;
      
      if (reading.second.type == "DHT11") {
        sensorObj["temperature"] = reading.second.temperature;
        sensorObj["humidity"] = reading.second.humidity;
      } else if (reading.second.type == "MQ2") {
        sensorObj["gas"] = reading.second.gas;
      } else if (reading.second.type == "ASC") {
        sensorObj["current"] = reading.second.current;
      } else if (reading.second.type == "LDR") {
        sensorObj["light"] = reading.second.light;
      } else if (reading.second.type == "PIR") {
        sensorObj["motion"] = reading.second.motion;
      } else if (reading.second.type == "BUTTON") {
        sensorObj["pressed"] = reading.second.pressed;
      }
    }
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleActuatorControl() {
  if (!checkAuthentication()) return;
  
  if (server.hasArg("id") && server.hasArg("action")) {
    String actuatorId = server.arg("id");
    String action = server.arg("action");
    
    for (auto* actuator : actuators) {
      if (actuator->getId() == actuatorId) {
        if (action == "turn_on") {
          actuator->turnOn();
        } else if (action == "turn_off") {
          actuator->turnOff();
        } else if (action == "toggle") {
          actuator->toggle();
        }
        
        server.send(200, "application/json", "{\"success\":true,\"state\":" + String(actuator->getState() ? "true" : "false") + "}");
        return;
      }
    }
    
    server.send(404, "application/json", "{\"success\":false,\"error\":\"Actuator not found\"}");
  } else {
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing parameters\"}");
  }
}

void handleConfig() {
  if (!checkAuthentication()) return;
  
  if (server.method() == HTTP_GET) {
    // Return current configuration
    File file = SPIFFS.open("/configuration.json", "r");
    if (file) {
      server.streamFile(file, "application/json");
      file.close();
    } else {
      server.send(404, "application/json", "{\"error\":\"Configuration file not found\"}");
    }
  } else if (server.method() == HTTP_POST) {
    // Update configuration (requires root password)
    if (!server.hasArg("root_password")) {
      server.send(401, "application/json", "{\"error\":\"Root password required\"}");
      return;
    }
    
    String rootPassword = server.arg("root_password");
    if (rootPassword != config.system.auth.rootPassword) {
      server.send(401, "application/json", "{\"error\":\"Invalid root password\"}");
      return;
    }
    
    // Save new configuration
    String body = server.arg("plain");
    File file = SPIFFS.open("/configuration.json", "w");
    if (file) {
      file.print(body);
      file.close();
      
      // Reload configuration
      config.loadFromFile("/configuration.json");
      
      server.send(200, "application/json", "{\"success\":true}");
    } else {
      server.send(500, "application/json", "{\"error\":\"Failed to save configuration\"}");
    }
  }
}

void handleSystemStats() {
  if (!checkAuthentication()) return;
  
  JsonDocument doc;
  
  // Récupérer les statistiques système ESP32
  doc["freeMemory"] = String(ESP.getFreeHeap() / 1024) + " KB";
  doc["totalMemory"] = String(ESP.getHeapSize() / 1024) + " KB";
  doc["cpuFreq"] = String(ESP.getCpuFreqMHz()) + " MHz";
  doc["uptime"] = String(millis() / 1000) + " sec";
  doc["flashSize"] = String(ESP.getFlashChipSize() / 1024 / 1024) + " MB";
  doc["wifiRSSI"] = String(WiFi.RSSI()) + " dBm";
  doc["connectedClients"] = WiFi.softAPgetStationNum();
  
  // Température interne (approximative)
  float temp = (esp_random() % 10) + 35; // Simulation entre 35-44°C
  doc["cpuTemp"] = String(temp, 1) + "°C";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleNotFound() {
  String path = server.uri();
  
  if (SPIFFS.exists(path)) {
    File file = SPIFFS.open(path, "r");
    String contentType = getContentType(path);
    server.streamFile(file, contentType);
    file.close();
  } else {
    // Captive portal redirect
    if (config.system.captivePortal) {
      server.sendHeader("Location", "http://192.168.4.1/", true);
      server.send(302, "text/plain", "");
    } else {
      server.send(404, "text/plain", "File not found");
    }
  }
}

void updateSensors() {
  for (auto* sensor : sensors) {
    if (sensor->isReady()) {
      SensorReading reading = sensor->read();
      
      // Ne stocker que les lectures valides
      if (reading.isValid) {
        latestReadings[sensor->getId()] = reading;
      } else {
        // Supprimer les lectures invalides du cache
        latestReadings.erase(sensor->getId());
        Serial.println("Sensor " + sensor->getId() + ": Removed invalid reading from cache");
      }
    }
  }
}

void updateStatusLED() {
  // Vérifier s'il y a une alarme active (buzzer en marche)
  bool alarmActive = false;
  for (auto* actuator : actuators) {
    for (const auto& deviceConfig : config.devices) {
      if (deviceConfig.id == actuator->getId() && deviceConfig.actuatorType == "BUZZER") {
        if (actuator->getState()) {
          alarmActive = true;
          break;
        }
      }
    }
    if (alarmActive) break;
  }
  
  if (alarmActive) {
    statusLED.setStatus(LEDStatus::ALARM_ACTIVE);
    return;
  }
  
  // Vérifier si des actionneurs sont actifs
  bool anyActuatorActive = false;
  for (auto* actuator : actuators) {
    for (const auto& deviceConfig : config.devices) {
      if (deviceConfig.id == actuator->getId() && deviceConfig.actuatorType == "RELAY") {
        if (actuator->getState()) {
          anyActuatorActive = true;
          break;
        }
      }
    }
    if (anyActuatorActive) break;
  }
  
  if (anyActuatorActive) {
    statusLED.setStatus(LEDStatus::SYSTEM_NORMAL_ACTIVE);
  } else {
    statusLED.setStatus(LEDStatus::SYSTEM_NORMAL_IDLE);
  }
}

void processRules() {
  for (const auto& rule : config.rules) {
    if (rule.enabled) {
      evaluateRule(rule);
    }
  }
}

void evaluateRule(const RuleConfig& rule) {
  Serial.println("Evaluating rule: " + rule.name + " (ID: " + rule.id + ")");
  
  bool shouldActivate = false;
  
  if (rule.triggerType == "sensor_threshold" || rule.triggerType == "sensor_combination") {
    Serial.println("Rule type: " + rule.triggerType);
    shouldActivate = evaluateConditions(rule.conditions, latestReadings);
  } else if (rule.triggerType == "critical_event") {
    Serial.println("Rule type: critical_event");
    shouldActivate = evaluateConditions(rule.conditions, latestReadings);
  } else if (rule.triggerType == "schedule") {
    Serial.println("Rule type: schedule");
    shouldActivate = evaluateSchedule(rule.schedule);
  }
  
  Serial.println("Rule result: " + String(shouldActivate ? "ACTIVATE" : "NO ACTION"));
  
  if (shouldActivate) {
    Serial.println("Activating rule: " + rule.name);
    executeActions(rule.actions);
  } else if (!rule.deactivationConditions.empty()) {
    bool shouldDeactivate = evaluateConditions(rule.deactivationConditions, latestReadings);
    if (shouldDeactivate) {
      Serial.println("Deactivating rule: " + rule.name);
      // Turn off associated actuators
      for (const auto& action : rule.actions) {
        for (auto* actuator : actuators) {
          if (actuator->getId() == action.actuatorId) {
            Serial.println("Turning off actuator: " + action.actuatorId);
            actuator->turnOff();
          }
        }
      }
    }
  }
  
  Serial.println("Rule evaluation completed for: " + rule.name);
}

bool evaluateConditions(const std::vector<Condition>& conditions, const std::map<String, SensorReading>& readings) {
  if (conditions.empty()) return false;
  
  bool result = true;
  String lastLogic = "AND";
  bool firstCondition = true;
  
  for (const auto& condition : conditions) {
    auto it = readings.find(condition.sensorId);
    if (it == readings.end()) {
      Serial.println("Rule evaluation: Sensor " + condition.sensorId + " not found or disconnected");
      continue;
    }
    
    const SensorReading& reading = it->second;
    
    // Ignorer les capteurs avec des lectures invalides
    if (!reading.isValid) {
      Serial.println("Rule evaluation: Sensor " + condition.sensorId + " has invalid reading, skipping");
      continue;
    }
    bool conditionResult = false;
    
    float sensorValue = 0;
    if (condition.parameter == "temperature") sensorValue = reading.temperature;
    else if (condition.parameter == "humidity") sensorValue = reading.humidity;
    else if (condition.parameter == "gas") sensorValue = reading.gas;
    else if (condition.parameter == "current") sensorValue = reading.current;
    else if (condition.parameter == "light") sensorValue = reading.light;
    else if (condition.parameter == "motion") sensorValue = reading.motion ? 1 : 0;
    else if (condition.parameter == "pressed") sensorValue = reading.pressed ? 1 : 0;
    
    // Plus de valeurs d'erreur -999, toutes les valeurs sont maintenant valides
    // Les capteurs déconnectés retournent des valeurs par défaut sécurisées
    
    if (condition.operator_ == ">") conditionResult = sensorValue > condition.value;
    else if (condition.operator_ == "<") conditionResult = sensorValue < condition.value;
    else if (condition.operator_ == "==") conditionResult = abs(sensorValue - condition.value) < 0.1;
    else if (condition.operator_ == ">=") conditionResult = sensorValue >= condition.value;
    else if (condition.operator_ == "<=") conditionResult = sensorValue <= condition.value;
    
    Serial.println("Rule evaluation: " + condition.sensorId + "." + condition.parameter + 
                   " (" + String(sensorValue) + ") " + condition.operator_ + " " + 
                   String(condition.value) + " = " + (conditionResult ? "true" : "false"));
    
    if (firstCondition) {
      result = conditionResult;
      firstCondition = false;
    } else {
      if (lastLogic == "AND") {
        result = result && conditionResult;
      } else if (lastLogic == "OR") {
        result = result || conditionResult;
      }
    }
    
    lastLogic = condition.logic.isEmpty() ? "AND" : condition.logic;
  }
  
  return result;
}

bool evaluateSchedule(const Schedule& schedule) {
  // Pour une implémentation simple, nous utiliserons millis() pour simuler l'heure
  // Dans une vraie implémentation, il faudrait un module RTC
  
  if (schedule.startTime.isEmpty() || schedule.endTime.isEmpty()) {
    Serial.println("Schedule evaluation: Missing start or end time");
    return false;
  }
  
  // Simulation basique : activation entre 13:00 et 16:00 (règle 3)
  // En production, il faudrait parser les heures et utiliser un RTC
  unsigned long currentTime = millis();
  unsigned long hourOfDay = (currentTime / (1000 * 60 * 60)) % 24; // Heure simulée
  
  // Pour la démonstration, considérons que l'ESP32 a démarré à 00:00
  bool isInTimeRange = false;
  
  if (schedule.startTime == "13:00" && schedule.endTime == "16:00") {
    // Activer pendant 3 heures après 13 heures de fonctionnement
    unsigned long startMillis = 13 * 60 * 60 * 1000; // 13 heures en ms
    unsigned long endMillis = 16 * 60 * 60 * 1000;   // 16 heures en ms
    isInTimeRange = (currentTime >= startMillis && currentTime <= endMillis);
  }
  
  Serial.println("Schedule evaluation: Current time simulation = " + String(hourOfDay) + 
                 ":xx, In range = " + String(isInTimeRange ? "true" : "false"));
  
  return isInTimeRange;
}

void executeActions(const std::vector<Action>& actions) {
  Serial.println("Executing " + String(actions.size()) + " action(s)");
  
  for (const auto& action : actions) {
    bool actuatorFound = false;
    
    for (auto* actuator : actuators) {
      if (actuator->getId() == action.actuatorId) {
        actuatorFound = true;
        
        Serial.println("Executing action: " + action.action + " on actuator " + action.actuatorId);
        
        if (action.action == "turn_on") {
          actuator->turnOn();
          
          // Set duration for timed operations
          if (action.duration > 0) {
            Serial.println("Setting duration: " + String(action.duration) + "ms");
            for (const auto& deviceConfig : config.devices) {
              if (deviceConfig.id == actuator->getId() && deviceConfig.actuatorType == "RELAY") {
                RelayActuator* relay = static_cast<RelayActuator*>(actuator);
                relay->setDuration(action.duration);
                break;
              }
            }
          }
          
          // Set pattern for buzzers
          if (!action.pattern.isEmpty()) {
            Serial.println("Setting pattern: " + action.pattern);
            for (const auto& deviceConfig : config.devices) {
              if (deviceConfig.id == actuator->getId() && deviceConfig.actuatorType == "BUZZER") {
                BuzzerActuator* buzzer = static_cast<BuzzerActuator*>(actuator);
                buzzer->setPattern(action.pattern);
                break;
              }
            }
          }
        } else if (action.action == "turn_off") {
          actuator->turnOff();
        } else if (action.action == "toggle") {
          actuator->toggle();
        }
        
        Serial.println("Action completed successfully");
        break;
      }
    }
    
    if (!actuatorFound) {
      Serial.println("Warning: Actuator " + action.actuatorId + " not found for action " + action.action);
    }
  }
}

String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  else if (filename.endsWith(".css")) return "text/css";
  else if (filename.endsWith(".js")) return "application/javascript";
  else if (filename.endsWith(".json")) return "application/json";
  else if (filename.endsWith(".ico")) return "image/x-icon";
  else if (filename.endsWith(".svg")) return "image/svg+xml";
  return "text/plain";
}

bool checkAuthentication() {
  if (!authenticated) {
    server.send(401, "application/json", "{\"error\":\"Authentication required\"}");
    return false;
  }
  return true;
}
