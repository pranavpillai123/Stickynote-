import { useState, useEffect, useRef } from 'react';

// Custom, premium dropdown selector to avoid dark-mode styling issues on native OS selects
function CustomSelect({ value, options, onChange, type }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  // Automatically scroll the active option into view (helpful for the minutes list)
  useEffect(() => {
    if (isOpen && type === 'minute' && dropdownRef.current) {
      const activeItem = dropdownRef.current.querySelector('.custom-option.selected');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [isOpen, type]);

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button 
        type="button" 
        className={`custom-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{value}</span>
        <span className="arrow-icon">▼</span>
      </button>

      {isOpen && (
        <div className={`custom-dropdown-menu type-${type}`} ref={dropdownRef}>
          {type === 'hour' && (
            <div className="hour-grid">
              {options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`custom-option ${value === opt ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {type === 'minute' && (
            <div className="minute-list">
              {options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`custom-option ${value === opt ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {type === 'period' && (
            <div className="period-list">
              {options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`custom-option ${value === opt ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DateTimePicker({ visible, currentValue, onApply, onCancel, onClear }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('AM');

  const [warningMessage, setWarningMessage] = useState('');
  const [shakeClass, setShakeClass] = useState('');

  // Sync state with currentValue when modal becomes visible
  useEffect(() => {
    if (visible) {
      let initialDate = currentValue ? new Date(currentValue) : null;
      
      // If no valid date or past date, default to a future date
      if (!initialDate || isNaN(initialDate.getTime())) {
        initialDate = null;
      }

      if (initialDate) {
        setSelectedDate(initialDate);
        setCurrentMonth(initialDate.getMonth());
        setCurrentYear(initialDate.getFullYear());
        
        let h24 = initialDate.getHours();
        const pm = h24 >= 12;
        setPeriod(pm ? 'PM' : 'AM');
        
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        setHour(h12.toString().padStart(2, '0'));
        setMinute(initialDate.getMinutes().toString().padStart(2, '0'));
      } else {
        // Set defaults based on current time + 1 hour for convenience
        const defaultDate = new Date();
        defaultDate.setHours(defaultDate.getHours() + 1);
        
        setSelectedDate(defaultDate);
        setCurrentMonth(defaultDate.getMonth());
        setCurrentYear(defaultDate.getFullYear());
        
        let h24 = defaultDate.getHours();
        setPeriod(h24 >= 12 ? 'PM' : 'AM');
        
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        setHour(h12.toString().padStart(2, '0'));
        setMinute(defaultDate.getMinutes().toString().padStart(2, '0'));
      }
      setWarningMessage('');
      setShakeClass('');
    }
  }, [visible, currentValue]);

  if (!visible) return null;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calendar calculations
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  
  // Previous month padding
  const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonthIndex);

  const prevMonthDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push({
      day: daysInPrevMonth - i,
      month: prevMonthIndex,
      year: prevYear,
      isCurrentMonth: false
    });
  }

  // Current month days
  const currentMonthDays = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentMonthDays.push({
      day: i,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true
    });
  }

  // Next month padding to fill grid
  const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const totalSlots = 42; // 6 rows * 7 columns
  const remainingSlots = totalSlots - (prevMonthDays.length + currentMonthDays.length);
  
  const nextMonthDays = [];
  for (let i = 1; i <= remainingSlots; i++) {
    nextMonthDays.push({
      day: i,
      month: nextMonthIndex,
      year: nextYear,
      isCurrentMonth: false
    });
  }

  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const isToday = (day, month, year) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day, month, year) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const isPastDate = (day, month, year) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(year, month, day);
    return dateToCheck < today;
  };

  const handleDayClick = (dayObj) => {
    if (isPastDate(dayObj.day, dayObj.month, dayObj.year)) return;
    
    const newSelected = new Date(dayObj.year, dayObj.month, dayObj.day);
    setSelectedDate(newSelected);
    
    // Auto shift monthly navigation if clicking padding days
    if (dayObj.month !== currentMonth) {
      setCurrentMonth(dayObj.month);
      setCurrentYear(dayObj.year);
    }
  };

  // Convert selected hour/minute/period into degrees for analog hands
  const numericHour = parseInt(hour, 10);
  const numericMinute = parseInt(minute, 10);
  const hourDegree = ((numericHour % 12) * 30) + (numericMinute * 0.5); // 30 deg per hour, 0.5 deg per minute
  const minuteDegree = numericMinute * 6; // 6 deg per minute

  const handleSaveTime = () => {
    if (!selectedDate) {
      setWarningMessage('Please select a date first.');
      triggerShake();
      return;
    }

    let h = parseInt(hour, 10);
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    const finalDate = new Date(selectedDate);
    finalDate.setHours(h, parseInt(minute, 10), 0, 0);

    if (finalDate <= new Date()) {
      setWarningMessage('Reminder time cannot be in the past.');
      triggerShake();
      return;
    }

    onApply(finalDate);
  };

  const triggerShake = () => {
    setShakeClass('shake-animation');
    setTimeout(() => {
      setShakeClass('');
    }, 450);
  };

  // Generate hour/minute select options
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className={`fancy-picker-overlay ${visible ? 'visible' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <div className={`fancy-picker-container ${shakeClass}`}>
        
        {/* Date Selector Card */}
        <div className="picker-card date-card">
          <div className="picker-card-header">
            <h3>
              <span className="header-icon">≡</span> Select Date
            </h3>
            <span className="header-icon">📅</span>
          </div>

          <div className="calendar-content">
            <div className="calendar-nav">
              <button className="calendar-nav-btn" onClick={handlePrevMonth}>&lt;</button>
              <span className="calendar-month-year">{months[currentMonth]}, {currentYear}</span>
              <button className="calendar-nav-btn" onClick={handleNextMonth}>&gt;</button>
            </div>

            <div className="calendar-weekdays">
              {weekdays.map(w => <span key={w}>{w}</span>)}
            </div>

            <div className="calendar-days">
              {allDays.map((d, index) => {
                const isDayPast = isPastDate(d.day, d.month, d.year);
                return (
                  <div
                    key={index}
                    className={`calendar-day 
                      ${!d.isCurrentMonth ? 'muted' : ''} 
                      ${isToday(d.day, d.month, d.year) ? 'today' : ''} 
                      ${isSelected(d.day, d.month, d.year) ? 'selected' : ''} 
                      ${isDayPast ? 'disabled' : ''}
                    `}
                    onClick={() => handleDayClick(d)}
                  >
                    {d.day}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button className="picker-btn-save" onClick={handleSaveTime}>
              Apply Date
            </button>
            <button className="picker-link-btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>

        {/* Time Selector Card */}
        <div className="picker-card time-card">
          <div className="picker-card-header">
            <h3>
              <span className="header-icon">≡</span> Set Time
            </h3>
            <span className="header-icon">🕒</span>
          </div>

          <div className="digital-clock-display">
            <div className="digital-clock-glow">
              <span className="digital-time">{hour}</span>
              <span className="digital-colon">:</span>
              <span className="digital-time">{minute}</span>
              <span className="digital-period">{period}</span>
            </div>
          </div>

          <div className="time-inputs-container">
            <div className="time-dropdown-group">
              {/* Custom Hour Dropdown */}
              <CustomSelect 
                value={hour} 
                options={hourOptions} 
                onChange={setHour} 
                type="hour" 
              />

              {/* Custom Minute Dropdown */}
              <CustomSelect 
                value={minute} 
                options={minuteOptions} 
                onChange={setMinute} 
                type="minute" 
              />

              {/* Custom AM/PM Dropdown */}
              <CustomSelect 
                value={period} 
                options={['AM', 'PM']} 
                onChange={setPeriod} 
                type="period" 
              />
            </div>

            {warningMessage && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginBottom: '10px', fontWeight: 600 }}>
                {warningMessage}
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button className="picker-btn-save" onClick={handleSaveTime}>
              Set Time & Apply
            </button>
            {currentValue && (
              <button className="picker-clear-btn" onClick={onClear}>
                Clear Reminder
              </button>
            )}
            <button className="picker-link-btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>

      </div>
      
      {/* Inline styles for shake animation in custom picker */}
      <style>{`
        @keyframes shakePicker {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .shake-animation {
          animation: shakePicker 0.4s ease;
        }
      `}</style>
    </div>
  );
}
