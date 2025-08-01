#ifndef SENSOR_H
#define SENSOR_H

#include <Arduino.h>
#include <DHT.h>

struct SensorReading {
  String sensorId;
  String type;
  float temperature;
  float humidity;
  float gas;
  float current;
  float light;
  bool motion;
  bool pressed;
  bool isValid;  // true si la lecture est valide (capteur connecté)
  unsigned long timestamp;
};

class BaseSensor {
public:
  BaseSensor(String id, String name, int pin);
  virtual ~BaseSensor() {}
  
  virtual void init() = 0;
  virtual SensorReading read() = 0;
  virtual bool isReady();
  
  String getId() const { return _id; }
  String getName() const { return _name; }
  int getPin() const { return _pin; }
  void setReadInterval(unsigned long interval) { _readInterval = interval; }
  unsigned long getReadInterval() const { return _readInterval; }
  
protected:
  String _id;
  String _name;
  int _pin;
  unsigned long _lastRead;
  unsigned long _readInterval;
};

class DHT11Sensor : public BaseSensor {
public:
  DHT11Sensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
  
private:
  DHT* _dht;
};

class MQ2Sensor : public BaseSensor {
public:
  MQ2Sensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
};

class ASCSensor : public BaseSensor {
public:
  ASCSensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
  
private:
  float _sensitivity;
  float _voltage;
};

class LDRSensor : public BaseSensor {
public:
  LDRSensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
};

class PIRSensor : public BaseSensor {
public:
  PIRSensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
  
private:
  bool _lastState;
};

class ButtonSensor : public BaseSensor {
public:
  ButtonSensor(String id, String name, int pin);
  void init() override;
  SensorReading read() override;
  
private:
  bool _lastState;
  unsigned long _debounceTime;
  unsigned long _lastDebounceTime;
};

#endif
