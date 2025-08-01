#include "Sensor.h"

// BaseSensor Implementation
BaseSensor::BaseSensor(String id, String name, int pin) 
  : _id(id), _name(name), _pin(pin), _lastRead(0), _readInterval(1000) {}

bool BaseSensor::isReady() {
  return (millis() - _lastRead) >= _readInterval;
}

// DHT11Sensor Implementation
DHT11Sensor::DHT11Sensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin), _dht(nullptr) {}

void DHT11Sensor::init() {
  _dht = new DHT(_pin, DHT11);
  _dht->begin();
  Serial.println("DHT11 sensor initialized on pin " + String(_pin));
}

SensorReading DHT11Sensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "DHT11";
  reading.timestamp = millis();
  reading.isValid = false; // Par défaut invalide
  
  if (_dht) {
    reading.temperature = _dht->readTemperature();
    reading.humidity = _dht->readHumidity();
    
    if (isnan(reading.temperature) || isnan(reading.humidity)) {
      Serial.println("DHT11 Sensor " + _id + ": Failed to read - attempting recovery");
      
      // Tentative de réinitialisation
      _dht->begin();
      delay(150);
      
      // Seconde tentative
      reading.temperature = _dht->readTemperature();
      reading.humidity = _dht->readHumidity();
      
      if (isnan(reading.temperature) || isnan(reading.humidity)) {
        Serial.println("DHT11 Sensor " + _id + ": Capteur déconnecté - pas de données");
        reading.isValid = false; // Lecture invalide
        return reading; // Ne pas retourner de valeurs
      } else {
        Serial.println("DHT11 Sensor " + _id + ": Récupération réussie");
        reading.isValid = true;
      }
    } else {
      reading.isValid = true; // Lecture réussie
    }
    
    // Validation des plages réalistes seulement si la lecture est valide
    if (reading.isValid) {
      if (reading.temperature < -40 || reading.temperature > 80) {
        reading.isValid = false; // Valeur aberrante
      }
      if (reading.humidity < 0 || reading.humidity > 100) {
        reading.isValid = false; // Valeur aberrante
      }
    }
  } else {
    Serial.println("DHT11 Sensor " + _id + ": Non initialisé - pas de données");
    reading.isValid = false;
  }
  
  _lastRead = millis();
  return reading;
}

// MQ2Sensor Implementation
MQ2Sensor::MQ2Sensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin) {}

void MQ2Sensor::init() {
  pinMode(_pin, INPUT);
  Serial.println("MQ2 sensor initialized on pin " + String(_pin));
}

SensorReading MQ2Sensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "MQ2";
  reading.timestamp = millis();
  
  // Lectures multiples pour stabilité
  int rawValue1 = analogRead(_pin);
  delay(2);
  int rawValue2 = analogRead(_pin);
  delay(2);
  int rawValue3 = analogRead(_pin);
  
  // Vérification de stabilité des lectures
  int maxDiff = max(max(abs(rawValue1 - rawValue2), abs(rawValue2 - rawValue3)), abs(rawValue1 - rawValue3));
  
  // Vérification si le capteur est connecté
  bool isConnected = (maxDiff < 50) &&           // Valeurs stables
                     (rawValue1 > 10) &&         // Pas à zéro
                     (rawValue1 < 4080) &&       // Pas saturé
                     (rawValue2 > 10) && 
                     (rawValue2 < 4080);
  
  if (!isConnected) {
    Serial.println("MQ2 Sensor " + _id + ": Capteur déconnecté - pas de données");
    reading.isValid = false;
  } else {
    // Utiliser la moyenne des 3 lectures
    int avgValue = (rawValue1 + rawValue2 + rawValue3) / 3;
    reading.gas = map(avgValue, 0, 4095, 0, 1000);
    
    // Assurer que la valeur est positive
    if (reading.gas < 0) reading.gas = 0;
    if (reading.gas > 1000) reading.gas = 1000;
    
    reading.isValid = true;
  }
  
  _lastRead = millis();
  return reading;
}

// ASCSensor Implementation
ASCSensor::ASCSensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin), _sensitivity(0.1), _voltage(3.3) {}

void ASCSensor::init() {
  pinMode(_pin, INPUT);
  Serial.println("ASC sensor initialized on pin " + String(_pin));
}

SensorReading ASCSensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "ASC";
  reading.timestamp = millis();
  
  // Lectures multiples pour stabilité
  int rawValue1 = analogRead(_pin);
  delay(2);
  int rawValue2 = analogRead(_pin);
  delay(2);
  int rawValue3 = analogRead(_pin);
  
  // Vérification de stabilité des lectures
  int maxDiff = max(max(abs(rawValue1 - rawValue2), abs(rawValue2 - rawValue3)), abs(rawValue1 - rawValue3));
  
  // Vérification si le capteur est connecté
  bool isConnected = (maxDiff < 50) &&           // Valeurs stables
                     (rawValue1 > 10) &&         // Pas à zéro
                     (rawValue1 < 4080) &&       // Pas saturé
                     (rawValue2 > 10) && 
                     (rawValue2 < 4080);
  
  if (!isConnected) {
    Serial.println("ASC Sensor " + _id + ": Capteur déconnecté - pas de données");
    reading.isValid = false;
  } else {
    // Utiliser la moyenne des 3 lectures
    int avgValue = (rawValue1 + rawValue2 + rawValue3) / 3;
    float voltage = (avgValue / 4095.0) * _voltage;
    
    // Calcul du courant avec protection contre les valeurs négatives
    float currentCalc = (voltage - (_voltage / 2.0)) / _sensitivity;
    
    // JAMAIS de valeur négative - forcer à zéro minimum
    reading.current = (currentCalc < 0.0) ? 0.0 : currentCalc;
    
    // Limiter à une valeur maximale raisonnable (ex: 30A)
    if (reading.current > 30.0) reading.current = 30.0;
    
    reading.isValid = true;
  }
  
  _lastRead = millis();
  return reading;
}

// LDRSensor Implementation
LDRSensor::LDRSensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin) {}

void LDRSensor::init() {
  pinMode(_pin, INPUT);
  Serial.println("LDR sensor initialized on pin " + String(_pin));
}

SensorReading LDRSensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "LDR";
  reading.timestamp = millis();
  
  // Lectures multiples pour stabilité
  int rawValue1 = analogRead(_pin);
  delay(2);
  int rawValue2 = analogRead(_pin);
  delay(2);
  int rawValue3 = analogRead(_pin);
  
  // Vérification de stabilité des lectures
  int maxDiff = max(max(abs(rawValue1 - rawValue2), abs(rawValue2 - rawValue3)), abs(rawValue1 - rawValue3));
  
  // Vérification si le capteur est connecté
  bool isConnected = (maxDiff < 50) &&           // Valeurs stables
                     (rawValue1 > 10) &&         // Pas à zéro
                     (rawValue1 < 4080) &&       // Pas saturé
                     (rawValue2 > 10) && 
                     (rawValue2 < 4080);
  
  if (!isConnected) {
    Serial.println("LDR Sensor " + _id + ": Capteur déconnecté - pas de données");
    reading.isValid = false;
  } else {
    // Utiliser la moyenne des 3 lectures
    int avgValue = (rawValue1 + rawValue2 + rawValue3) / 3;
    reading.light = map(avgValue, 0, 4095, 0, 1023);
    
    // Assurer que la valeur est dans la plage correcte
    if (reading.light < 0) reading.light = 0;
    if (reading.light > 1023) reading.light = 1023;
    
    reading.isValid = true;
  }
  
  _lastRead = millis();
  return reading;
}

// PIRSensor Implementation
PIRSensor::PIRSensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin), _lastState(false) {}

void PIRSensor::init() {
  pinMode(_pin, INPUT);
  _lastState = digitalRead(_pin);
  Serial.println("PIR sensor initialized on pin " + String(_pin));
}

SensorReading PIRSensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "PIR";
  reading.timestamp = millis();
  
  bool currentState = digitalRead(_pin);
  reading.motion = currentState;
  reading.isValid = true; // Les capteurs digitaux sont toujours valides
  _lastState = currentState;
  
  _lastRead = millis();
  return reading;
}

// ButtonSensor Implementation
ButtonSensor::ButtonSensor(String id, String name, int pin) 
  : BaseSensor(id, name, pin), _lastState(true), _debounceTime(50), _lastDebounceTime(0) {}

void ButtonSensor::init() {
  pinMode(_pin, INPUT_PULLUP);
  _lastState = digitalRead(_pin);
  Serial.println("Button sensor initialized on pin " + String(_pin));
}

SensorReading ButtonSensor::read() {
  SensorReading reading;
  reading.sensorId = _id;
  reading.type = "BUTTON";
  reading.timestamp = millis();
  
  bool currentState = digitalRead(_pin);
  
  if (currentState != _lastState) {
    _lastDebounceTime = millis();
  }
  
  if ((millis() - _lastDebounceTime) > _debounceTime) {
    reading.pressed = !currentState; // Inverted because of INPUT_PULLUP
    _lastState = currentState;
  } else {
    reading.pressed = false;
  }
  
  reading.isValid = true; // Les capteurs digitaux sont toujours valides
  
  _lastRead = millis();
  return reading;
}
