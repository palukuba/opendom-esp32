#ifndef STATUS_LED_H
#define STATUS_LED_H

#include <Arduino.h>

enum class LEDStatus {
  SYSTEM_NORMAL_IDLE,    // Bleu - Système fonctionne, aucun actionneur actif
  SYSTEM_NORMAL_ACTIVE,  // Vert - Système fonctionne, actionneur(s) actif(s)
  ALARM_ACTIVE          // Rouge - Alarme active
};

class StatusLED {
public:
  StatusLED(int redPin, int greenPin, int bluePin);
  
  void init();
  void setStatus(LEDStatus status);
  void update(); // Pour les effets de clignotement
  void turnOff();
  
  // Méthodes utilitaires
  void setColor(int red, int green, int blue);
  void blink(int red, int green, int blue, unsigned long interval = 500);
  
private:
  int _redPin;
  int _greenPin;
  int _bluePin;
  
  LEDStatus _currentStatus;
  bool _blinkState;
  unsigned long _lastBlink;
  unsigned long _blinkInterval;
  
  // Couleurs prédéfinies
  void setRed();
  void setGreen(); 
  void setBlue();
  void setOff();
};

#endif
