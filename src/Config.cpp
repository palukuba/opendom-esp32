#include "Config.h"
#include <SPIFFS.h>

bool Config::loadFromFile(const String& filename) {
  if (!SPIFFS.exists(filename)) {
    Serial.println("Configuration file not found: " + filename);
    return false;
  }
  
  File file = SPIFFS.open(filename, "r");
  if (!file) {
    Serial.println("Failed to open configuration file");
    return false;
  }
  
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();
  
  if (error) {
    Serial.println("Failed to parse configuration file: " + String(error.c_str()));
    return false;
  }
  
  JsonObject systemObj = doc["system"];
  parseSystemConfig(systemObj);
  
  JsonArray devicesArray = doc["devices"];
  parseDevices(devicesArray);
  
  JsonArray rulesArray = doc["rules"];
  parseRules(rulesArray);
  
  Serial.println("Configuration loaded successfully");
  return true;
}

void Config::parseSystemConfig(JsonObject& systemObj) {
  system.wifi.ssid = systemObj["wifi"]["ssid"].as<String>();
  system.wifi.password = systemObj["wifi"]["password"].as<String>();
  system.auth.username = systemObj["auth"]["username"].as<String>();
  system.auth.password = systemObj["auth"]["password"].as<String>();
  system.auth.rootPassword = systemObj["auth"]["root_password"].as<String>();
  system.captivePortal = systemObj["captive_portal"].as<bool>();
}

void Config::parseDevices(JsonArray& devicesArray) {
  devices.clear();
  for (JsonObject deviceObj : devicesArray) {
    DeviceConfig device;
    device.id = deviceObj["id"].as<String>();
    device.name = deviceObj["name"].as<String>();
    device.type = deviceObj["type"].as<String>();
    device.sensorType = deviceObj["sensor_type"].as<String>();
    device.actuatorType = deviceObj["actuator_type"].as<String>();
    device.pin = deviceObj["pin"].as<int>();
    device.enabled = deviceObj["enabled"].as<bool>();
    device.readInterval = deviceObj["read_interval"].as<unsigned long>();
    device.state = deviceObj["state"].as<bool>();
    devices.push_back(device);
  }
}

void Config::parseRules(JsonArray& rulesArray) {
  rules.clear();
  for (JsonObject ruleObj : rulesArray) {
    RuleConfig rule;
    rule.id = ruleObj["id"].as<String>();
    rule.name = ruleObj["name"].as<String>();
    rule.enabled = ruleObj["enabled"].as<bool>();
    rule.triggerType = ruleObj["trigger_type"].as<String>();
    
    if (!ruleObj["conditions"].isNull()) {
      JsonArray conditionsArray = ruleObj["conditions"];
      parseConditions(conditionsArray, rule.conditions);
    }
    
    if (!ruleObj["actions"].isNull()) {
      JsonArray actionsArray = ruleObj["actions"];
      parseActions(actionsArray, rule.actions);
    }
    
    if (!ruleObj["deactivation_conditions"].isNull()) {
      JsonArray deactivationArray = ruleObj["deactivation_conditions"];
      parseConditions(deactivationArray, rule.deactivationConditions);
    }
    
    if (!ruleObj["schedule"].isNull()) {
      JsonObject scheduleObj = ruleObj["schedule"];
      rule.schedule.startTime = scheduleObj["start_time"].as<String>();
      rule.schedule.endTime = scheduleObj["end_time"].as<String>();
      JsonArray daysArray = scheduleObj["days"];
      for (JsonVariant day : daysArray) {
        rule.schedule.days.push_back(day.as<String>());
      }
    }
    
    rules.push_back(rule);
  }
}

void Config::parseConditions(JsonArray& conditionsArray, std::vector<Condition>& conditions) {
  for (JsonObject conditionObj : conditionsArray) {
    Condition condition;
    condition.sensorId = conditionObj["sensor_id"].as<String>();
    condition.parameter = conditionObj["parameter"].as<String>();
    condition.operator_ = conditionObj["operator"].as<String>();
    condition.value = conditionObj["value"].as<float>();
    condition.logic = conditionObj["logic"].as<String>();
    conditions.push_back(condition);
  }
}

void Config::parseActions(JsonArray& actionsArray, std::vector<Action>& actions) {
  for (JsonObject actionObj : actionsArray) {
    Action action;
    action.actuatorId = actionObj["actuator_id"].as<String>();
    action.action = actionObj["action"].as<String>();
    action.duration = actionObj["duration"].as<unsigned long>();
    action.pattern = actionObj["pattern"].as<String>();
    actions.push_back(action);
  }
}

bool Config::saveToFile(const String& filename) {
  JsonDocument doc;
  
  // Serialize system config
  JsonObject system = doc["system"].to<JsonObject>();
  JsonObject wifi = system["wifi"].to<JsonObject>();
  wifi["ssid"] = this->system.wifi.ssid;
  wifi["password"] = this->system.wifi.password;
  
  JsonObject auth = system["auth"].to<JsonObject>();
  auth["username"] = this->system.auth.username;
  auth["password"] = this->system.auth.password;
  auth["root_password"] = this->system.auth.rootPassword;
  
  system["captive_portal"] = this->system.captivePortal;
  
  // Serialize devices
  JsonArray devices = doc["devices"].to<JsonArray>();
  for (const auto& device : this->devices) {
    JsonObject deviceObj = devices.add<JsonObject>();
    deviceObj["id"] = device.id;
    deviceObj["name"] = device.name;
    deviceObj["type"] = device.type;
    if (!device.sensorType.isEmpty()) deviceObj["sensor_type"] = device.sensorType;
    if (!device.actuatorType.isEmpty()) deviceObj["actuator_type"] = device.actuatorType;
    deviceObj["pin"] = device.pin;
    deviceObj["enabled"] = device.enabled;
    if (device.readInterval > 0) deviceObj["read_interval"] = device.readInterval;
    deviceObj["state"] = device.state;
  }
  
  // Serialize rules
  JsonArray rules = doc["rules"].to<JsonArray>();
  for (const auto& rule : this->rules) {
    JsonObject ruleObj = rules.add<JsonObject>();
    ruleObj["id"] = rule.id;
    ruleObj["name"] = rule.name;
    ruleObj["enabled"] = rule.enabled;
    ruleObj["trigger_type"] = rule.triggerType;
    
    if (!rule.conditions.empty()) {
      JsonArray conditions = ruleObj["conditions"].to<JsonArray>();
      for (const auto& condition : rule.conditions) {
        JsonObject conditionObj = conditions.add<JsonObject>();
        conditionObj["sensor_id"] = condition.sensorId;
        conditionObj["parameter"] = condition.parameter;
        conditionObj["operator"] = condition.operator_;
        conditionObj["value"] = condition.value;
        if (!condition.logic.isEmpty()) conditionObj["logic"] = condition.logic;
      }
    }
    
    if (!rule.actions.empty()) {
      JsonArray actions = ruleObj["actions"].to<JsonArray>();
      for (const auto& action : rule.actions) {
        JsonObject actionObj = actions.add<JsonObject>();
        actionObj["actuator_id"] = action.actuatorId;
        actionObj["action"] = action.action;
        if (action.duration > 0) actionObj["duration"] = action.duration;
        if (!action.pattern.isEmpty()) actionObj["pattern"] = action.pattern;
      }
    }
  }
  
  File file = SPIFFS.open(filename, "w");
  if (!file) {
    Serial.println("Failed to open file for writing");
    return false;
  }
  
  serializeJsonPretty(doc, file);
  file.close();
  
  Serial.println("Configuration saved successfully");
  return true;
}

void Config::printConfig() {
  Serial.println("=== OPENDOM Configuration ===");
  Serial.println("WiFi SSID: " + system.wifi.ssid);
  Serial.println("Username: " + system.auth.username);
  Serial.println("Devices count: " + String(devices.size()));
  Serial.println("Rules count: " + String(rules.size()));
  Serial.println("==============================");
}
