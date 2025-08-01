#ifndef ACTUATOR_H
#define ACTUATOR_H

#include <Arduino.h>

class BaseActuator {
public:
  BaseActuator(String id, String name, int pin);
  virtual ~BaseActuator() {}
  
  virtual void init() = 0;
  virtual void turnOn() = 0;
  virtual void turnOff() = 0;
  virtual void toggle() = 0;
  virtual bool getState() = 0;
  virtual void setState(bool state) = 0;
  
  String getId() const { return _id; }
  String getName() const { return _name; }
  int getPin() const { return _pin; }
  
protected:
  String _id;
  String _name;
  int _pin;
  bool _state;
  unsigned long _lastAction;
};

class RelayActuator : public BaseActuator {
public:
  RelayActuator(String id, String name, int pin, bool normallyOpen = true);
  void init() override;
  void turnOn() override;
  void turnOff() override;
  void toggle() override;
  bool getState() override;
  void setState(bool state) override;
  
  void setDuration(unsigned long duration);
  void update(); // Call this in main loop to handle timed operations
  
private:
  bool _normallyOpen;
  unsigned long _duration;
  unsigned long _turnOnTime;
  bool _timedOperation;
};

class BuzzerActuator : public BaseActuator {
public:
  BuzzerActuator(String id, String name, int pin);
  void init() override;
  void turnOn() override;
  void turnOff() override;
  void toggle() override;
  bool getState() override;
  void setState(bool state) override;
  
  void setPattern(String pattern);
  void update(); // Call this in main loop to handle patterns
  
private:
  String _pattern;
  unsigned long _patternStartTime;
  int _patternStep;
  bool _patternActive;
  
  void playAlarmPattern();
  void playBeepPattern();
};

#endif
