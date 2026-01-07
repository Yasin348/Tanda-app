import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import {
  HomeScreen,
  CreateTandaScreen,
  TandaDetailScreen,
  JoinTandaScreen,
  ProfileScreen,
  SecuritySettingsScreen,
  DepositScreen,
  WithdrawScreen,
  KYCScreen,
  DevToolsScreen,
} from '../screens/main';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon: React.FC<{ icon: string; focused: boolean; label: string }> = ({
  icon,
  focused,
  label,
}) => (
  <View style={styles.tabIconContainer}>
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
  </View>
);

const HomeTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" focused={focused} label="Inicio" />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" focused={focused} label="Perfil" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: '#1e293b',
        },
        headerTintColor: '#3b82f6',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateTanda"
        component={CreateTandaScreen as any}
        options={{ title: 'Nueva tanda' }}
      />
      <Stack.Screen
        name="TandaDetail"
        component={TandaDetailScreen as any}
        options={{ title: 'Detalle' }}
      />
      <Stack.Screen
        name="JoinTanda"
        component={JoinTandaScreen as any}
        options={{ title: 'Unirse' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen as any}
        options={{ title: 'Mi perfil' }}
      />
      <Stack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen as any}
        options={{ title: 'Seguridad' }}
      />
      <Stack.Screen
        name="Deposit"
        component={DepositScreen as any}
        options={{ title: 'Depositar' }}
      />
      <Stack.Screen
        name="Withdraw"
        component={WithdrawScreen as any}
        options={{ title: 'Retirar' }}
      />
      <Stack.Screen
        name="KYC"
        component={KYCScreen as any}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DevTools"
        component={DevToolsScreen as any}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.5,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  tabLabelFocused: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
