#include "Actuator.h"

// BaseActuator Implementation
BaseActuator::BaseActuator(String id, String name, int pin) 
  : _id(id), _name(name), _pin(pin), _state(false), _lastAction(0) {}

// RelayActuator Implementation
RelayActuator::RelayActuator(String id, String name, int pin, bool normallyOpen) 
  : BaseActuator(id, name, pin), _normallyOpen(normallyOpen), _duration(0), 
    _turnOnTime(0), _timedOperation(false) {}

void RelayActuator::init() {
  pinMode(_pin, OUTPUT);
  setState(false);
  Serial.println("Relay actuator initialized on pin " + String(_pin));
}

void RelayActuator::turnOn() {
  _state = true;
  digitalWrite(_pin, _normallyOpen ? HIGH : LOW);
  _lastAction = millis();
  _turnOnTime = millis();
  Serial.println("Relay " + _id + " turned ON");
}

void RelayActuator::turnOff() {
  _state = false;
  digitalWrite(_pin, _normallyOpen ? LOW : HIGH);
  _lastAction = millis();
  _timedOperation = false;
  Serial.println("Relay " + _id + " turned OFF");
}

void RelayActuator::toggle() {
  if (_state) {
    turnOff();
  } else {
    turnOn();
  }
}

bool RelayActuator::getState() {
  return _state;
}

void RelayActuator::setState(bool state) {
  if (state) {
    turnOn();
  } else {
    turnOff();
  }
}

void RelayActuator::setDuration(unsigned long duration) {
  _duration = duration;
  if (duration > 0 && _state) {
    _timedOperation = true;
    _turnOnTime = millis();
  }
}

void RelayActuator::update() {
  if (_timedOperation && _state && _duration > 0) {
    if (millis() - _turnOnTime >= _duration) {
      turnOff();
    }
  }
}

// BuzzerActuator Implementation
BuzzerActuator::BuzzerActuator(String id, String name, int pin) 
  : BaseActuator(id, name, pin), _pattern(""), _patternStartTime(0), 
    _patternStep(0), _patternActive(false) {}

void BuzzerActuator::init() {
  pinMode(_pin, OUTPUT);
  setState(false);
  Serial.println("Buzzer actuator initialized on pin " + String(_pin));
}

void BuzzerActuator::turnOn() {
  _state = true;
  digitalWrite(_pin, HIGH);
  _lastAction = millis();
  Serial.println("Buzzer " + _id + " turned ON");
}

void BuzzerActuator::turnOff() {
  _state = false;
  digitalWrite(_pin, LOW);
  _lastAction = millis();
  _patternActive = false;
  Serial.println("Buzzer " + _id + " turned OFF");
}

void BuzzerActuator::toggle() {
  if (_state) {
    turnOff();
  } else {
    turnOn();
  }
}

bool BuzzerActuator::getState() {
  return _state;
}

void BuzzerActuator::setState(bool state) {
  if (state) {
    turnOn();
  } else {
    turnOff();
  }
}

void BuzzerActuator::setPattern(String pattern) {
  _pattern = pattern;
  if (pattern != "") {
    _patternActive = true;
    _patternStartTime = millis();
    _patternStep = 0;
  }
}

void BuzzerActuator::update() {
  if (!_patternActive) return;
  
  if (_pattern == "alarm") {
    playAlarmPattern();
  } else if (_pattern == "beep") {
    playBeepPattern();
  }
}

void BuzzerActuator::playAlarmPattern() {
  unsigned long elapsed = millis() - _patternStartTime;
  unsigned long cycleTime = elapsed % 1000; // 1 second cycle
  
  if (cycleTime < 500) { // ON for 500ms
    if (!_state) {
      digitalWrite(_pin, HIGH);
      _state = true;
    }
  } else { // OFF for 500ms
    if (_state) {
      digitalWrite(_pin, LOW);
      _state = false;
    }
  }
}

void BuzzerActuator::playBeepPattern() {
  unsigned long elapsed = millis() - _patternStartTime;
  unsigned long cycleTime = elapsed % 2000; // 2 second cycle
  
  if (cycleTime < 100) { // Short beep for 100ms
    if (!_state) {
      digitalWrite(_pin, HIGH);
      _state = true;
    }
  } else { // OFF for the rest
    if (_state) {
      digitalWrite(_pin, LOW);
      _state = false;
    }
  }
}
