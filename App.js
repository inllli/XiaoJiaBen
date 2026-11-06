
import React, { useContext, useState } from 'react';
import 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, AppContext } from './src/context/AppContext';
import { COLORS, SHADOWS } from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import LifeScreen from './src/screens/LifeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import UserScreen from './src/screens/UserScreen';
import AddItemModal from './src/components/AddItemModal';

const Tab = createBottomTabNavigator();

function MainTabs() {
  const { toastMsg, toastVisible, themeColors: tc } = useContext(AppContext);
  const [globalAddVisible, setGlobalAddVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: tc.bg }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false, tabBarActiveTintColor: COLORS.primaryGreen, tabBarInactiveTintColor: tc.textSub,
            // 左右滑动切换 Tab（“左滑右滑返回上一层”的手势支持）
            swipeEnabled: true,
            tabBarStyle: { height: 75, paddingBottom: 15, paddingTop: 10, backgroundColor: tc.isDark ? 'rgba(52, 55, 60, 0.96)' : 'rgba(255, 255, 255, 0.95)', borderTopWidth: 0, ...SHADOWS.nav },
            tabBarLabel: ({ color, focused }) => <Text style={{ fontSize: 11, color: color, marginTop: 4, fontWeight: focused ? '600' : '400' }}>{route.name}</Text>,
            tabBarIcon: ({ focused, color }) => {
              let iconName;
              if (route.name === '首页') iconName = focused ? 'home' : 'home-outline';
              else if (route.name === '生活') iconName = focused ? 'list' : 'list-outline';
              else if (route.name === '日历') iconName = focused ? 'calendar' : 'calendar-outline';
              else if (route.name === '我的') iconName = focused ? 'person' : 'person-outline';
              return <Ionicons name={iconName} size={24} color={color} />;
            },
          })}
        >
          <Tab.Screen name="首页" component={HomeScreen} />
          <Tab.Screen name="生活" component={LifeScreen} />
          <Tab.Screen name="日历" component={CalendarScreen} />
          <Tab.Screen name="我的" component={UserScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      <TouchableOpacity style={styles.globalAddBtn} onPress={() => setGlobalAddVisible(true)}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      <AddItemModal visible={globalAddVisible} onClose={() => setGlobalAddVisible(false)} />

      {toastVisible && (
        <View style={styles.toastContainer}><View style={styles.toastContent}><Text style={styles.toastText}>{toastMsg}</Text></View></View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <MainTabs />
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  globalAddBtn: { position: 'absolute', bottom: 40, left: '50%', marginLeft: -28, width: 56, height: 56, backgroundColor: COLORS.primaryGreen, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...SHADOWS.glass, zIndex: 100 },
  toastContainer: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toastContent: { backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});