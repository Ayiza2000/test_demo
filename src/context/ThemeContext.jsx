import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      const defaultTheme = prefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      applyTheme(defaultTheme);
    }
    
    // Debug: Log current theme
    console.log('Current theme:', theme);
    console.log('HTML classes:', document.documentElement.classList);
    console.log('HTML data-theme:', document.documentElement.getAttribute('data-theme'));
  }, []);

  const applyTheme = (newTheme) => {
    const htmlElement = document.documentElement;
    
    console.log('Applying theme:', newTheme); // Debug
    
    if (newTheme === 'dark') {
      htmlElement.classList.add('dark');
      console.log('Added dark class'); // Debug
    } else {
      htmlElement.classList.remove('dark');
      console.log('Removed dark class'); // Debug
    }
    
    htmlElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Toggling to:', newTheme); // Debug
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};