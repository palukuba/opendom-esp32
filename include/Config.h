#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <map>

struct WiFiConfig {
  String ssid;
  String password;
};

struct AuthConfig {
  String username;
  String password;
  String rootPassword;
};

struct SystemConfig {
  WiFiConfig wifi;
  AuthConfig auth;
  bool captivePortal;
};

struct DeviceConfig {
  String id;
  String name;
  String type;
  String sensorType;
  String actuatorType;
  int pin;
  bool enabled;
  unsigned long readInterval;
  bool state;
};

struct Condition {
  String sensorId;
  String parameter;
  String operator_;
  float value;
  String logic;
};

struct Action {
  String actuatorId;
  String action;
  unsigned long duration;
  String pattern;
};

struct Schedule {
  String startTime;
  String endTime;
  std::vector<String> days;
};

struct RuleConfig {
  String id;
  String name;
  bool enabled;
  String triggerType;
  std::vector<Condition> conditions;
  std::vector<Action> actions;
  std::vector<Condition> deactivationConditions;
  Schedule schedule;
};

class Config {
public:
  SystemConfig system;
  std::vector<DeviceConfig> devices;
  std::vector<RuleConfig> rules;
  
  bool loadFromFile(const String& filename);
  bool saveToFile(const String& filename);
  void printConfig();
  
private:
  void parseSystemConfig(JsonObject& systemObj);
  void parseDevices(JsonArray& devicesArray);
  void parseRules(JsonArray& rulesArray);
  void parseConditions(JsonArray& conditionsArray, std::vector<Condition>& conditions);
  void parseActions(JsonArray& actionsArray, std::vector<Action>& actions);
};

#endif
