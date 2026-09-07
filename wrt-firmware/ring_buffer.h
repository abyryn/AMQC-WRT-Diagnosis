// ============================================
// WRT Garage — Ring Buffer (Data Logger)
// Lock-free ring buffer for sensor samples
// ============================================
#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <Arduino.h>
#include "ecu_data.h"
#include "config.h"

class SensorRingBuffer {
public:
  SensorRingBuffer() : _head(0), _tail(0), _count(0), _overflow(false) {}

  bool push(const LoggerSample& sample) {
    _buffer[_head] = sample;
    _head = (_head + 1) % LOGGER_BUFFER_SIZE;

    if (_count >= LOGGER_BUFFER_SIZE) {
      _tail = (_tail + 1) % LOGGER_BUFFER_SIZE; // Overwrite oldest
      _overflow = true;
    } else {
      _count++;
    }
    return true;
  }

  bool pop(LoggerSample* sample) {
    if (_count == 0) return false;
    *sample = _buffer[_tail];
    _tail = (_tail + 1) % LOGGER_BUFFER_SIZE;
    _count--;
    return true;
  }

  bool peek(LoggerSample* sample) const {
    if (_count == 0) return false;
    *sample = _buffer[_tail];
    return true;
  }

  uint16_t count() const { return _count; }
  bool isEmpty() const { return _count == 0; }
  bool isFull() const { return _count >= LOGGER_BUFFER_SIZE; }
  bool hasOverflow() const { return _overflow; }
  void clearOverflow() { _overflow = false; }

  void clear() {
    _head = 0;
    _tail = 0;
    _count = 0;
    _overflow = false;
  }

  // Access by index (0 = oldest)
  bool getAt(uint16_t index, LoggerSample* sample) const {
    if (index >= _count) return false;
    uint16_t pos = (_tail + index) % LOGGER_BUFFER_SIZE;
    *sample = _buffer[pos];
    return true;
  }

private:
  LoggerSample _buffer[LOGGER_BUFFER_SIZE];
  volatile uint16_t _head;
  volatile uint16_t _tail;
  volatile uint16_t _count;
  volatile bool _overflow;
};

#endif // RING_BUFFER_H
