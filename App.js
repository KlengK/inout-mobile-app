import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import { LogOut, ScanLine, BookOpen, AlertCircle, RefreshCw } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

// =====================================================================
// API CONFIGURATION
// =====================================================================
// This is the key we use to store the API key on the device
const API_KEY_NAME = 'inout_api_key';

// *** TODO: PASTE YOUR SUPABASE FUNCTION URLS HERE ***
// This is from Phase 2
const LOGIN_URL = 'https://jqfszxggwifciciktmog.supabase.co/functions/v1/login';

// These are for Phase 4 (we will build these later)
const LOCATIONS_URL = 'https://<your-project-id>.supabase.co/functions/v1/get-locations';
const SCAN_URL = 'https://<your-project-id>.supabase.co/functions/v1/create-entry';
const LOG_URL = 'https://<your-project-id>.supabase.co/functions/v1/get-entries';
// =====================================================================

/**
 * Custom hook to manage authentication
 */
function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState(null);

  // Check for stored API key on app load
  useEffect(() => {
    async function loadKey() {
      try {
        const storedKey = await SecureStore.getItemAsync(API_KEY_NAME);
        if (storedKey) {
          setApiKey(storedKey);
        }
      } catch (e) {
        console.error('Failed to load API key', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadKey();
  }, []);

  const login = async (key) => {
    try {
      await SecureStore.setItemAsync(API_KEY_NAME, key);
      setApiKey(key);
    } catch (e) {
      console.error('Failed to save API key', e);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(API_KEY_NAME);
      setApiKey(null);
    } catch (e) {
      console.error('Failed to delete API key', e);
    }
  };

  return { isLoading, apiKey, login, logout };
}

/**
 * Login Screen Component
 */
function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    // This is the "Moment of Truth" test from Phase 2.
    // It calls the Supabase Function URL defined at the top of the file.
    
    // Make sure you have updated the LOGIN_URL constant!
    if (LOGIN_URL.includes('<your-project-id>')) {
      setError('Please update the LOGIN_URL in App.js with your Supabase Function URL.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.success && data.api_key) {
        // SUCCESS!
        onLoginSuccess(data.api_key);
      } else {
        // ERROR! Check for the specific PHP error from our gateway
        if (data.php_error_body) {
          // We found it! Display the PHP error.
          setError(`PHP Fatal Error: ${data.php_error_body}`);
        } else {
          // Fallback for other errors (e.g., "Invalid username")
          setError(data.message || data.error || 'An unknown error occurred.');
        }
      }
    } catch (err) {
      setError(`A network error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>Library Scanner Login</Text>
        <Text style={styles.subtitle}>Enter your staff credentials.</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Username"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Password"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={20} color="#B91C1C" />
            <Text style={styles.errorText} selectable={true}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * Scan Screen Component
 * NOTE: This will not work until we create the Supabase functions in Phase 4.
 */
function ScanScreen({ apiKey, onLogout }) {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(undefined);
  const [cardId, setCardId] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Fetch locations from the API
  const fetchLocations = useCallback(async () => {
    // This function will call our new 'get-locations' gateway function
    if (LOCATIONS_URL.includes('<your-project-id>')) {
      setError('Locations URL not configured in App.js.');
      return;
    }
    
    try {
      const response = await fetch(LOCATIONS_URL); // Simple GET request
      const data = await response.json();
      if (data.success) {
        setLocations(data.data);
      } else {
        setError('Failed to load locations.');
      }
    } catch (err) {
      setError('Network error loading locations.');
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Handle the scan button press
  const handleScan = async () => {
    if (SCAN_URL.includes('<your-project-id>')) {
      setError('Scan URL not configured in App.js.');
      return;
    }
    if (!selectedLocation) {
      setError('Please select a location.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setScanResult(null);

    try {
      // This will call our new 'create-entry' gateway function
      const response = await fetch(SCAN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Our gateway will securely add the *real* API key
          // But we still send the *login* (session) key for auth
          'Authorization': `Bearer ${apiKey}`, 
        },
        body: JSON.stringify({
          cardnumber: cardId,
          location_id: selectedLocation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScanResult(data);
        setCardId(''); // Clear input for next scan
      } else {
        setError(data.message || 'Scan failed.');
      }
    } catch (err) {
      setError('A network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Scan Patron" onLogout={onLogout} />
      <ScrollView style={styles.pageContainer}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedLocation}
            onValueChange={(itemValue) => setSelectedLocation(itemValue)}
          >
            <Picker.Item label="Select a location..." value={undefined} />
            {locations.map((loc) => (
              <Picker.Item key={loc.id} label={loc.loc} value={loc.id} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="Enter Patron Card ID..."
          style={styles.input}
          value={cardId}
          onChangeText={setCardId}
        />
        
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleScan}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Submit Scan</Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={20} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {scanResult && (
          <View style={[
            styles.resultCard, 
            scanResult.status === 'OUT' ? styles.resultCardOut : styles.resultCardIn
          ]}>
            <View style={styles.resultHeader}>
              <Image
                // Use a placeholder if no image is provided
                source={{ uri: `data:image/png;base64,${scanResult.image}` || 'https://placehold.co/128x128/e0e0e0/757575?text=?' }}
                onError={() => console.log('Failed to load image')}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.resultName}>{scanResult.name || 'Unknown Patron'}</Text>
                <Text style={styles.resultTime}>Time: {scanResult.time}</Text>
              </View>
            </View>
            <View>
              <Text style={[
                styles.resultStatus,
                scanResult.status === 'OUT' ? styles.resultStatusOut : styles.resultStatusIn
              ]}>
                STATUS: {scanResult.status}
              </Text>
              <Text style={styles.resultMessage}>{scanResult.message}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Log Screen Component
 * NOTE: This will not work until we create the Supabase functions in Phase 4.
 */
function LogScreen({ apiKey, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (LOG_URL.includes('<your-project-id>')) {
      setError('Log URL not configured in App.js.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // This will call our new 'get-entries' gateway function
      const response = await fetch(LOG_URL, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setEntries(data.data);
      } else {
        setError(data.message || 'Failed to load entries.');
      }
    } catch (err) {
      setError('Network error loading entries.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Today's Log" onLogout={onLogout}>
        <TouchableOpacity onPress={fetchEntries} disabled={isLoading} style={{padding: 8}}>
          <RefreshCw size={24} color={isLoading ? '#9CA3AF' : '#1D4ED8'} />
        </TouchableOpacity>
      </AppHeader>
      <ScrollView style={styles.pageContainer}>
        {isLoading && entries.length === 0 && <ActivityIndicator size="large" color="#1D4ED8" />}
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={20} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!isLoading && entries.length === 0 && !error && (
          <Text style={styles.emptyText}>No entries found for today.</Text>
        )}
        {entries.map((entry) => (
          <View key={entry.sl} style={styles.logCard}>
            <View>
              <Text style={styles.logName}>{entry.name}</Text>
              <Text style={styles.logLocation}>{entry.loc}</Text>
              <Text style={styles.logTime}>Entry: {entry.entry} | Exit: {entry.exit === '00:00:00' ? 'N/A' : entry.exit}</Text>
            </View>
            <View 
              style={[
                styles.statusBadge, 
                entry.status === 'IN' ? styles.statusBadgeIn : styles.statusBadgeOut
              ]}
            >
              <Text style={
                entry.status === 'IN' ? styles.statusBadgeTextIn : styles.statusBadgeTextOut
              }>{entry.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * AppHeader Component
 * A reusable header for the main app screens
 */
const AppHeader = ({ title, onLogout, children }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.headerActions}>
      {children}
      <TouchableOpacity onPress={onLogout} style={{padding: 8, marginLeft: 8}}>
        <LogOut size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  </View>
);

/**
 * Main Tab Navigator
 */
const Tab = createBottomTabNavigator();

function MainAppTabs({ apiKey, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Scan') {
            return <ScanLine size={size} color={color} />;
          } else if (route.name === 'Log') {
            return <BookOpen size={size} color={color} />;
          }
          return null;
        },
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#6B7280',
      })}
    >
      <Tab.Screen name="Scan">
        {(props) => <ScanScreen {...props} apiKey={apiKey} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Log">
        {(props) => <LogScreen {...props} apiKey={apiKey} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

/**
 * Root App Component
 * This is the main entry point, which manages auth state.
 */
export default function App() {
  const { isLoading, apiKey, login, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      {!apiKey ? (
        <LoginScreen onLoginSuccess={login} />
      ) : (
        <MainAppTabs apiKey={apiKey} onLogout={logout} />
      )}
    </NavigationContainer>
  );
}

/**
 * Stylesheet
 * All styles for the app are defined here.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  pageContainer: {
    padding: 16,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#6B7280',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  button: {
    height: 50,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    marginLeft: 8,
    fontSize: 14,
    flex: 1, // Allow text to wrap
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerContainer: {
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  resultCard: {
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  resultCardIn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  resultCardOut: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB', // Placeholder background
  },
  resultName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  resultTime: {
    fontSize: 14,
    color: '#4B5563',
  },
  resultStatus: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultStatusIn: {
    color: '#065F46',
  },
  resultStatusOut: {
    color: '#1E40AF',
  },
  resultMessage: {
    fontSize: 14,
    color: '#4B5563',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1, // Allow name to wrap if long
  },
  logLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginVertical: 2,
  },
  logTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginLeft: 8, // Add space
  },
  statusBadgeIn: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeOut: {
    backgroundColor: '#DBEAFE',
  },
  statusBadgeTextIn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  statusBadgeTextOut: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
    color: '#6B7280',
  },
});