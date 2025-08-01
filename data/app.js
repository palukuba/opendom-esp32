// OPENDOM PWA - Application JavaScript améliorée
class OpenDOMApp {
    constructor() {
        this.authenticated = false;
        this.currentUser = '';
        this.sensors = new Map();
        this.actuators = new Map();
        this.rules = new Map();
        this.updateInterval = null;
        this.currentEditingDevice = null;
        this.currentEditingRule = null;
        this.pendingAction = null;
        this.activeTab = 'devices';
        
        this.init();
    }

    init() {
        this.initEventListeners();
        this.initTheme();
        this.initServiceWorker();
        
        // Check if already authenticated
        const token = localStorage.getItem('auth_token');
        if (token) {
            this.showMainApp();
            this.startDataUpdates();
        }
    }

    initEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Navigation (sans surveillance)
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // Profile modal
        document.getElementById('profileBtn').addEventListener('click', () => {
            this.showProfileModal();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Settings toggles
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('notificationToggle').addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('testNotificationBtn').addEventListener('click', () => {
            this.showNotification('Test OPENDOM', 'Alerte de test avec son et vibration!');
        });

        // Tab management
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Device management
        document.getElementById('addDeviceBtn').addEventListener('click', () => {
            this.showAddDeviceModal();
        });

        // Rule management
        document.getElementById('addRuleBtn').addEventListener('click', () => {
            this.showAddRuleModal();
        });

        document.getElementById('ruleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRuleSubmit();
        });

        document.getElementById('triggerType').addEventListener('change', (e) => {
            this.updateRuleFormSections(e.target.value);
        });

        document.getElementById('addConditionBtn').addEventListener('click', () => {
            this.addConditionField();
        });

        document.getElementById('addActionBtn').addEventListener('click', () => {
            this.addActionField();
        });

        // Device form
        document.getElementById('deviceForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDeviceSubmit();
        });

        document.getElementById('deviceType').addEventListener('change', (e) => {
            this.toggleDeviceTypeFields(e.target.value);
        });

        // Modal controls
        document.getElementById('closeDeviceModal').addEventListener('click', () => {
            this.hideDeviceModal();
        });

        document.getElementById('cancelDevice').addEventListener('click', () => {
            this.hideDeviceModal();
        });

        // Rule modal controls
        document.getElementById('closeRuleModal').addEventListener('click', () => {
            this.hideRuleModal();
        });

        document.getElementById('cancelRule').addEventListener('click', () => {
            this.hideRuleModal();
        });

        // Root password modal
        document.getElementById('confirmRootAuth').addEventListener('click', () => {
            this.handleRootAuth();
        });

        document.getElementById('cancelRootAuth').addEventListener('click', () => {
            this.hideRootPasswordModal();
        });

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (savedTheme === 'dark') {
            themeToggle.classList.add('active');
        }
    }

    initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('auth_token', 'authenticated');
                localStorage.setItem('current_user', data.user);
                this.currentUser = data.user;
                this.authenticated = true;
                this.showMainApp();
                this.startDataUpdates();
                errorDiv.textContent = '';
            } else {
                errorDiv.textContent = data.error || 'Erreur de connexion';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Erreur de connexion au serveur';
        }
    }

    handleLogout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        this.authenticated = false;
        this.currentUser = '';
        this.stopDataUpdates();
        this.showLoginScreen();
        this.hideProfileModal();
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        this.updateProfile();
        this.loadDevices();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName + 'Section').classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Load section-specific data
        if (sectionName === 'home') {
            this.updateDeviceCards();
        } else if (sectionName === 'devices') {
            this.loadDevicesManagement();
        } else if (sectionName === 'settings') {
            this.updateSystemStats();
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab').classList.add('active');
        
        // Load tab-specific data
        if (tabName === 'devices') {
            this.loadDevicesManagement();
        } else if (tabName === 'rules') {
            this.loadRulesManagement();
        }
    }

    showProfileModal() {
        document.getElementById('profileModal').classList.add('active');
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.remove('active');
    }

    updateProfile() {
        document.getElementById('profileName').textContent = this.currentUser;
        document.getElementById('profileRole').textContent = 'Propriétaire';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (newTheme === 'dark') {
            themeToggle.classList.add('active');
        } else {
            themeToggle.classList.remove('active');
        }
    }

    toggleNotifications() {
        const toggle = document.getElementById('notificationToggle');
        toggle.classList.toggle('active');
        
        const enabled = toggle.classList.contains('active');
        localStorage.setItem('notifications_enabled', enabled);
        
        if (enabled && 'Notification' in window) {
            Notification.requestPermission();
        }
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            // Clear existing devices and rules
            this.sensors.clear();
            this.actuators.clear();
            this.rules.clear();
            
            // Store devices data
            config.devices.forEach(device => {
                if (device.type === 'sensor') {
                    this.sensors.set(device.id, device);
                } else if (device.type === 'actuator') {
                    this.actuators.set(device.id, device);
                }
            });
            
            // Store rules data
            if (config.rules) {
                config.rules.forEach(rule => {
                    this.rules.set(rule.id, rule);
                });
            }
            
            this.updateDeviceCards();
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    }

    async updateSensorData() {
        try {
            const response = await fetch('/api/sensors');
            const data = await response.json();
            
            // Marquer tous les capteurs comme déconnectés au début
            const receivedSensorIds = new Set();
            
            data.sensors.forEach(reading => {
                receivedSensorIds.add(reading.id);
                this.updateSensorReading(reading);
            });
            
            // Marquer les capteurs qui n'ont pas envoyé de données comme déconnectés
            this.sensors.forEach((sensor, sensorId) => {
                if (!receivedSensorIds.has(sensorId)) {
                    // Capteur déconnecté - créer une lecture invalide
                    const disconnectedReading = {
                        id: sensorId,
                        type: sensor.sensor_type,
                        isValid: false,
                        timestamp: Date.now()
                    };
                    this.updateSensorReading(disconnectedReading);
                }
            });
        } catch (error) {
            console.error('Error updating sensor data:', error);
            // En cas d'erreur réseau, marquer tous les capteurs comme déconnectés
            this.sensors.forEach((sensor, sensorId) => {
                const errorReading = {
                    id: sensorId,
                    type: sensor.sensor_type,
                    isValid: false,
                    timestamp: Date.now()
                };
                this.updateSensorReading(errorReading);
            });
        }
    }

    updateSensorReading(reading) {
        const sensor = this.sensors.get(reading.id);
        if (!sensor) return;

        // Update sensor data in memory
        sensor.lastReading = reading;
        sensor.timestamp = reading.timestamp;

        // Update UI if device card exists
        const deviceCard = document.querySelector(`[data-device-id="${reading.id}"]`);
        if (deviceCard) {
            this.updateDeviceCardData(deviceCard, reading);
        }

        // Check for alerts
        this.checkSensorAlerts(reading);
    }

    updateDeviceCards() {
        const container = document.getElementById('deviceCards');
        container.innerHTML = '';

        // Create cards for sensors
        this.sensors.forEach(sensor => {
            const card = this.createSensorCard(sensor);
            container.appendChild(card);
        });

        // Create cards for actuators
        this.actuators.forEach(actuator => {
            const card = this.createActuatorCard(actuator);
            container.appendChild(card);
        });
    }

    createSensorCard(device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.setAttribute('data-device-id', device.id);

        const icon = this.getDeviceIcon(device.sensor_type);
        const statusClass = device.enabled ? 'online' : 'offline';

        card.innerHTML = `
            <div class="device-card-header">
                <h3>${device.name}</h3>
                <div class="device-icon">${icon}</div>
            </div>
            <div class="device-status">
                <div class="status-indicator ${statusClass}"></div>
                <span>${device.enabled ? 'En ligne' : 'Hors ligne'}</span>
            </div>
            <div class="device-data">
                <div class="device-value" id="value-${device.id}">--</div>
                <div class="device-unit" id="unit-${device.id}">Lecture en cours...</div>
            </div>
        `;

        return card;
    }

    createActuatorCard(device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.setAttribute('data-device-id', device.id);

        const icon = this.getDeviceIcon(device.actuator_type);
        const statusClass = device.enabled ? 'online' : 'offline';
        const toggleClass = device.state ? 'active' : '';
        const dangerClass = device.actuator_type === 'BUZZER' ? 'danger' : '';

        card.innerHTML = `
            <div class="device-card-header">
                <h3>${device.name}</h3>
                <div class="device-icon">${icon}</div>
            </div>
            <div class="device-status">
                <div class="status-indicator ${statusClass}"></div>
                <span>${device.enabled ? 'En ligne' : 'Hors ligne'}</span>
            </div>
            <div class="device-data">
                <div class="device-value">${device.state ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</div>
            </div>
            <div class="device-controls">
                <button class="actuator-toggle ${toggleClass} ${dangerClass}" 
                        onclick="app.toggleActuator('${device.id}')"
                        data-device-id="${device.id}">
                    <div class="toggle-indicator">
                        ${device.state ? '●' : '○'}
                    </div>
                </button>
                <span class="toggle-label">${device.state ? 'ON' : 'OFF'}</span>
            </div>
        `;

        return card;
    }

    updateDeviceCardData(card, reading) {
        const valueElement = card.querySelector(`#value-${reading.id}`);
        const unitElement = card.querySelector(`#unit-${reading.id}`);

        if (!valueElement) return;

        // Vérifier si le capteur a des données valides
        if (!reading.isValid || reading.isValid === false) {
            // Capteur déconnecté - afficher "pas de données"
            valueElement.textContent = '--';
            unitElement.textContent = 'Capteur déconnecté';
            this.updateDeviceStatus(card, 'error');
            return;
        }

        // Afficher les données valides
        switch (reading.type) {
            case 'DHT11':
                valueElement.textContent = `${reading.temperature.toFixed(1)}°C`;
                unitElement.textContent = `Humidité: ${reading.humidity.toFixed(1)}%`;
                this.updateDeviceStatus(card, 'online');
                break;
            case 'MQ2':
                valueElement.textContent = reading.gas.toFixed(0);
                unitElement.textContent = 'ppm (gaz)';
                this.updateDeviceStatus(card, 'online');
                break;
            case 'ASC':
                valueElement.textContent = reading.current.toFixed(2);
                unitElement.textContent = 'A (courant)';
                this.updateDeviceStatus(card, 'online');
                break;
            case 'LDR':
                valueElement.textContent = reading.light.toFixed(0);
                unitElement.textContent = 'lux (luminosité)';
                this.updateDeviceStatus(card, 'online');
                break;
            case 'PIR':
                valueElement.textContent = reading.motion ? 'MOUVEMENT' : 'AUCUN';
                unitElement.textContent = 'Détection';
                this.updateDeviceStatus(card, 'online');
                break;
            case 'BUTTON':
                valueElement.textContent = reading.pressed ? 'PRESSÉ' : 'RELÂCHÉ';
                unitElement.textContent = 'État du bouton';
                this.updateDeviceStatus(card, 'online');
                break;
        }
    }

    updateDeviceStatus(card, status) {
        const indicator = card.querySelector('.status-indicator');
        indicator.className = `status-indicator ${status}`;
    }

    async toggleActuator(actuatorId) {
        try {
            const response = await fetch('/api/actuators', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `id=${actuatorId}&action=toggle`
            });

            const data = await response.json();
            if (data.success) {
                // Update actuator state in memory
                const actuator = this.actuators.get(actuatorId);
                if (actuator) {
                    actuator.state = data.state;
                    this.updateActuatorCard(actuatorId, data.state);
                }
            }
        } catch (error) {
            console.error('Error toggling actuator:', error);
        }
    }

    updateActuatorCard(actuatorId, state) {
        const card = document.querySelector(`[data-device-id="${actuatorId}"]`);
        if (!card) return;

        const toggle = card.querySelector('.actuator-toggle');
        const valueElement = card.querySelector('.device-value');
        const labelElement = card.querySelector('.toggle-label');
        const indicator = toggle.querySelector('.toggle-indicator');

        if (state) {
            toggle.classList.add('active');
            valueElement.textContent = 'ACTIVÉ';
            labelElement.textContent = 'ON';
            indicator.textContent = '●';
        } else {
            toggle.classList.remove('active');
            valueElement.textContent = 'DÉSACTIVÉ';
            labelElement.textContent = 'OFF';
            indicator.textContent = '○';
        }
    }

    checkSensorAlerts(reading) {
        if (reading.type === 'MQ2' && reading.gas > 400) {
            this.showNotification('Alerte Gaz', 'Niveau critique détecté!');
        } else if (reading.type === 'BUTTON' && reading.pressed) {
            this.showNotification('Urgence', 'Bouton d\'alarme pressé!');
        } else if (reading.type === 'DHT11' && reading.temperature > 35) {
            this.showNotification('Température', 'Température élevée détectée');
        }
    }

    showNotification(title, body) {
        const notificationsEnabled = localStorage.getItem('notifications_enabled') === 'true';
        
        // Vibrer le téléphone si supporté
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]); // Pattern de vibration
        }
        
        // Jouer un son d'alerte
        this.playNotificationSound();
        
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                requireInteraction: true // Notification persistante
            });
        }
        
        // Afficher aussi une notification interne
        this.showInternalNotification(title + ': ' + body);
    }

    playNotificationSound() {
        // Créer un son d'alerte synthétique
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configuration du son d'alerte
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    showInternalNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'internal-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger);
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Device Management Functions
    showAddDeviceModal() {
        this.currentEditingDevice = null;
        document.getElementById('deviceModalTitle').textContent = 'Ajouter un appareil';
        this.resetDeviceForm();
        document.getElementById('deviceModal').classList.add('active');
    }

    showEditDeviceModal(deviceId) {
        this.currentEditingDevice = deviceId;
        document.getElementById('deviceModalTitle').textContent = 'Modifier l\'appareil';
        
        const device = this.sensors.get(deviceId) || this.actuators.get(deviceId);
        if (device) {
            this.populateDeviceForm(device);
        }
        
        document.getElementById('deviceModal').classList.add('active');
    }

    hideDeviceModal() {
        document.getElementById('deviceModal').classList.remove('active');
        this.resetDeviceForm();
    }

    resetDeviceForm() {
        document.getElementById('deviceForm').reset();
        document.getElementById('deviceEnabled').checked = true;
        this.toggleDeviceTypeFields('');
    }

    populateDeviceForm(device) {
        document.getElementById('deviceName').value = device.name;
        document.getElementById('deviceType').value = device.type;
        document.getElementById('devicePin').value = device.pin;
        document.getElementById('deviceEnabled').checked = device.enabled;
        
        if (device.type === 'sensor') {
            document.getElementById('sensorType').value = device.sensor_type;
            document.getElementById('readInterval').value = device.read_interval;
        } else {
            document.getElementById('actuatorType').value = device.actuator_type;
        }
        
        this.toggleDeviceTypeFields(device.type);
    }

    toggleDeviceTypeFields(type) {
        const sensorGroup = document.getElementById('sensorTypeGroup');
        const actuatorGroup = document.getElementById('actuatorTypeGroup');
        const intervalGroup = document.getElementById('readIntervalGroup');
        
        if (type === 'sensor') {
            sensorGroup.style.display = 'block';
            actuatorGroup.style.display = 'none';
            intervalGroup.style.display = 'block';
            document.getElementById('sensorType').required = true;
            document.getElementById('actuatorType').required = false;
        } else if (type === 'actuator') {
            sensorGroup.style.display = 'none';
            actuatorGroup.style.display = 'block';
            intervalGroup.style.display = 'none';
            document.getElementById('sensorType').required = false;
            document.getElementById('actuatorType').required = true;
        } else {
            sensorGroup.style.display = 'none';
            actuatorGroup.style.display = 'none';
            intervalGroup.style.display = 'none';
            document.getElementById('sensorType').required = false;
            document.getElementById('actuatorType').required = false;
        }
    }

    handleDeviceSubmit() {
        this.pendingAction = 'save_device';
        this.showRootPasswordModal();
    }

    async saveDevice() {
        const formData = new FormData(document.getElementById('deviceForm'));
        const deviceData = {
            id: this.currentEditingDevice || 'device_' + Date.now(),
            name: document.getElementById('deviceName').value,
            type: document.getElementById('deviceType').value,
            pin: parseInt(document.getElementById('devicePin').value),
            enabled: document.getElementById('deviceEnabled').checked
        };

        if (deviceData.type === 'sensor') {
            deviceData.sensor_type = document.getElementById('sensorType').value;
            deviceData.read_interval = parseInt(document.getElementById('readInterval').value);
        } else {
            deviceData.actuator_type = document.getElementById('actuatorType').value;
            deviceData.state = false;
        }

        try {
            // Get current config
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            
            // Update or add device
            const deviceIndex = config.devices.findIndex(d => d.id === deviceData.id);
            if (deviceIndex >= 0) {
                config.devices[deviceIndex] = deviceData;
            } else {
                config.devices.push(deviceData);
            }
            
            // Save config
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `root_password=${encodeURIComponent(this.rootPassword)}&` +
                      encodeURIComponent(JSON.stringify(config))
            });

            const result = await response.json();
            if (result.success) {
                this.hideDeviceModal();
                this.loadDevices();
                this.showInternalNotification('Appareil sauvegardé avec succès');
            } else {
                alert('Erreur lors de la sauvegarde: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving device:', error);
            alert('Erreur de connexion');
        }
    }

    deleteDevice(deviceId) {
        this.currentEditingDevice = deviceId;
        this.pendingAction = 'delete_device';
        this.showRootPasswordModal();
    }

    async performDeleteDevice() {
        try {
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            
            config.devices = config.devices.filter(d => d.id !== this.currentEditingDevice);
            
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `root_password=${encodeURIComponent(this.rootPassword)}&` +
                      encodeURIComponent(JSON.stringify(config))
            });

            const result = await response.json();
            if (result.success) {
                this.loadDevices();
                this.showInternalNotification('Appareil supprimé avec succès');
            } else {
                alert('Erreur lors de la suppression: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting device:', error);
            alert('Erreur de connexion');
        }
    }

    showRootPasswordModal() {
        document.getElementById('rootPasswordModal').classList.add('active');
        document.getElementById('rootPassword').focus();
    }

    hideRootPasswordModal() {
        document.getElementById('rootPasswordModal').classList.remove('active');
        document.getElementById('rootPassword').value = '';
        document.getElementById('rootPasswordError').textContent = '';
    }

    async handleRootAuth() {
        const password = document.getElementById('rootPassword').value;
        
        if (!password) {
            document.getElementById('rootPasswordError').textContent = 'Mot de passe requis';
            return;
        }

        this.rootPassword = password;
        this.hideRootPasswordModal();
        
        if (this.pendingAction === 'save_device') {
            await this.saveDevice();
        } else if (this.pendingAction === 'delete_device') {
            await this.performDeleteDevice();
        } else if (this.pendingAction === 'save_rule') {
            await this.saveRule();
        } else if (this.pendingAction === 'delete_rule') {
            await this.performDeleteRule();
        }
        
        this.pendingAction = null;
        this.rootPassword = null;
    }

    loadDevicesManagement() {
        const devicesList = document.getElementById('devicesList');
        devicesList.innerHTML = '';

        // Combine sensors and actuators
        const allDevices = [...this.sensors.values(), ...this.actuators.values()];

        allDevices.forEach(device => {
            const deviceItem = document.createElement('div');
            deviceItem.className = 'device-item';
            
            const deviceType = device.sensor_type || device.actuator_type;
            const pinInfo = `Pin: ${device.pin}`;
            const statusInfo = device.enabled ? 'Activé' : 'Désactivé';
            
            deviceItem.innerHTML = `
                <div class="device-info">
                    <h4>${device.name}</h4>
                    <p>${deviceType} - ${pinInfo} - ${statusInfo}</p>
                </div>
                <div class="device-actions">
                    <button class="btn btn-secondary" onclick="app.showEditDeviceModal('${device.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteDevice('${device.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            `;
            
            devicesList.appendChild(deviceItem);
        });
    }

    updateSystemStats() {
        // Récupérer les vraies stats du système ESP32
        fetch('/api/system')
            .then(response => response.json())
            .then(data => {
                document.getElementById('freeMemory').textContent = data.freeMemory || '--';
                document.getElementById('cpuTemp').textContent = data.cpuTemp || '--';
                document.getElementById('uptime').textContent = data.uptime || '--';
            })
            .catch(() => {
                // Fallback values si l'API n'est pas disponible
                document.getElementById('freeMemory').textContent = '245 KB';
                document.getElementById('cpuTemp').textContent = '45°C';
                document.getElementById('uptime').textContent = this.formatUptime(Date.now() - (window.startTime || Date.now()));
            });
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}j ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }

    getDeviceIcon(deviceType) {
        const icons = {
            'DHT11': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>',
            'MQ2': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>',
            'ASC': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>',
            'LDR': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
            'PIR': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.83 14H16M9 18.12 7 22h10l-2-3.88"/></svg>',
            'BUTTON': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>',
            'RELAY': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v4h3l1 1v4l-1 1H6v4h4v-2h4v2h4v-4h-3l-1-1V8l1-1h3V4h-4v2h-4V4H6z"/><circle cx="12" cy="12" r="2"/></svg>',
            'BUZZER': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 15h2a2 2 0 002-2V9a2 2 0 00-2-2h-2v8z"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M5 9v6l4-2V9l-4 2z"/></svg>'
        };
        
        return icons[deviceType] || icons['BUTTON'];
    }

    // ==================== RULES MANAGEMENT ====================
    
    showAddRuleModal() {
        this.currentEditingRule = null;
        document.getElementById('ruleModalTitle').textContent = 'Ajouter une règle';
        this.resetRuleForm();
        document.getElementById('ruleModal').classList.add('active');
    }

    showEditRuleModal(ruleId) {
        this.currentEditingRule = ruleId;
        document.getElementById('ruleModalTitle').textContent = 'Modifier la règle';
        
        const rule = this.rules.get(ruleId);
        if (rule) {
            this.populateRuleForm(rule);
        }
        
        document.getElementById('ruleModal').classList.add('active');
    }

    hideRuleModal() {
        document.getElementById('ruleModal').classList.remove('active');
        this.resetRuleForm();
    }

    resetRuleForm() {
        document.getElementById('ruleForm').reset();
        document.getElementById('ruleEnabled').checked = true;
        document.getElementById('conditionsList').innerHTML = '';
        document.getElementById('actionsList').innerHTML = '';
        this.updateRuleFormSections('');
        this.currentEditingRule = null;
    }

    populateRuleForm(rule) {
        // Remplir les champs de base
        document.getElementById('ruleName').value = rule.name;
        document.getElementById('triggerType').value = rule.trigger_type;
        document.getElementById('ruleEnabled').checked = rule.enabled;
        
        // Mettre à jour les sections selon le type de déclenchement
        this.updateRuleFormSections(rule.trigger_type);
        
        // Remplir les conditions
        if (rule.conditions && rule.conditions.length > 0) {
            document.getElementById('conditionsList').innerHTML = '';
            rule.conditions.forEach(condition => {
                this.addConditionFromData(condition);
            });
        }
        
        // Remplir les actions
        if (rule.actions && rule.actions.length > 0) {
            document.getElementById('actionsList').innerHTML = '';
            rule.actions.forEach(action => {
                this.addActionFromData(action);
            });
        }
        
        // Remplir l'horaire si applicable
        if (rule.trigger_type === 'schedule' && rule.schedule) {
            document.getElementById('startTime').value = rule.schedule.start_time || '';
            document.getElementById('endTime').value = rule.schedule.end_time || '';
            
            // Sélectionner les jours
            if (rule.schedule.days) {
                rule.schedule.days.forEach(day => {
                    const checkbox = document.querySelector(`input[value="${day}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
    }

    updateRuleFormSections(triggerType) {
        const conditionsSection = document.getElementById('conditionsSection');
        const scheduleSection = document.getElementById('scheduleSection');
        const actionsSection = document.getElementById('actionsSection');
        
        // Hide all sections first
        conditionsSection.style.display = 'none';
        scheduleSection.style.display = 'none';
        actionsSection.style.display = 'none';
        
        if (triggerType === 'schedule') {
            scheduleSection.style.display = 'block';
            actionsSection.style.display = 'block';
        } else if (triggerType) {
            conditionsSection.style.display = 'block';
            actionsSection.style.display = 'block';
        }
    }

    addConditionField() {
        const conditionsList = document.getElementById('conditionsList');
        const conditionId = 'condition_' + Date.now();
        
        const conditionHtml = `
            <div class="condition-item" data-condition-id="${conditionId}">
                <div class="condition-row">
                    <div class="form-group">
                        <label>Capteur</label>
                        <select class="condition-sensor" required onchange="app.updateParameterOptions('${conditionId}')">
                            <option value="">Sélectionner...</option>
                            ${Array.from(this.sensors.values()).map(sensor => 
                                `<option value="${sensor.id}" data-type="${sensor.sensor_type}">${sensor.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Paramètre</label>
                        <select class="condition-parameter" required>
                            <option value="">Choisir un capteur d'abord</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Opérateur</label>
                        <select class="condition-operator" required>
                            <option value="">Sélectionner...</option>
                            <option value=">">Supérieur à</option>
                            <option value="<">Inférieur à</option>
                            <option value="==">Égal à</option>
                            <option value=">=">Supérieur ou égal</option>
                            <option value="<=">Inférieur ou égal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valeur</label>
                        <input type="number" class="condition-value" step="0.1" required>
                    </div>
                    <div class="form-group">
                        <label>Logique</label>
                        <select class="condition-logic">
                            <option value="">Aucune</option>
                            <option value="AND">ET</option>
                            <option value="OR">OU</option>
                        </select>
                    </div>
                    <button type="button" class="remove-btn" onclick="app.removeCondition('${conditionId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        conditionsList.insertAdjacentHTML('beforeend', conditionHtml);
    }

    addConditionFromData(condition) {
        const conditionsList = document.getElementById('conditionsList');
        const conditionId = 'condition_' + Date.now();
        
        const conditionHtml = `
            <div class="condition-item" data-condition-id="${conditionId}">
                <div class="condition-row">
                    <div class="form-group">
                        <label>Capteur</label>
                        <select class="condition-sensor" required onchange="app.updateParameterOptions('${conditionId}')">
                            <option value="">Sélectionner...</option>
                            ${Array.from(this.sensors.values()).map(sensor => 
                                `<option value="${sensor.id}" data-type="${sensor.sensor_type}" ${sensor.id === condition.sensor_id ? 'selected' : ''}>${sensor.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Paramètre</label>
                        <select class="condition-parameter" required>
                            <option value="${condition.parameter}" selected>${this.getParameterDisplayName(condition.parameter)}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Opérateur</label>
                        <select class="condition-operator" required>
                            <option value="">Sélectionner...</option>
                            <option value=">" ${condition.operator === '>' ? 'selected' : ''}>Supérieur à</option>
                            <option value="<" ${condition.operator === '<' ? 'selected' : ''}>Inférieur à</option>
                            <option value="==" ${condition.operator === '==' ? 'selected' : ''}>Égal à</option>
                            <option value=">=" ${condition.operator === '>=' ? 'selected' : ''}>Supérieur ou égal</option>
                            <option value="<=" ${condition.operator === '<=' ? 'selected' : ''}>Inférieur ou égal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valeur</label>
                        <input type="number" class="condition-value" step="0.1" value="${condition.value}" required>
                    </div>
                    <div class="form-group">
                        <label>Logique</label>
                        <select class="condition-logic">
                            <option value="">Aucune</option>
                            <option value="AND" ${condition.logic === 'AND' ? 'selected' : ''}>ET</option>
                            <option value="OR" ${condition.logic === 'OR' ? 'selected' : ''}>OU</option>
                        </select>
                    </div>
                    <button type="button" class="remove-btn" onclick="app.removeCondition('${conditionId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        conditionsList.insertAdjacentHTML('beforeend', conditionHtml);
        
        // Mettre à jour les paramètres après insertion
        this.updateParameterOptions(conditionId);
        
        // Resélectionner le bon paramètre
        const parameterSelect = document.querySelector(`[data-condition-id="${conditionId}"] .condition-parameter`);
        if (parameterSelect) {
            parameterSelect.value = condition.parameter;
        }
    }

    addActionField() {
        const actionsList = document.getElementById('actionsList');
        const actionId = 'action_' + Date.now();
        
        const actionHtml = `
            <div class="action-item" data-action-id="${actionId}">
                <div class="action-row">
                    <div class="form-group">
                        <label>Actionneur</label>
                        <select class="action-actuator" required>
                            <option value="">Sélectionner...</option>
                            ${Array.from(this.actuators.values()).map(actuator => 
                                `<option value="${actuator.id}">${actuator.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Action</label>
                        <select class="action-type" required>
                            <option value="">Sélectionner...</option>
                            <option value="turn_on">Activer</option>
                            <option value="turn_off">Désactiver</option>
                            <option value="toggle">Basculer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Durée (ms)</label>
                        <input type="number" class="action-duration" placeholder="Optionnel">
                    </div>
                    <button type="button" class="remove-btn" onclick="app.removeAction('${actionId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        actionsList.insertAdjacentHTML('beforeend', actionHtml);
    }

    addActionFromData(action) {
        const actionsList = document.getElementById('actionsList');
        const actionId = 'action_' + Date.now();
        
        const actionHtml = `
            <div class="action-item" data-action-id="${actionId}">
                <div class="action-row">
                    <div class="form-group">
                        <label>Actionneur</label>
                        <select class="action-actuator" required>
                            <option value="">Sélectionner...</option>
                            ${Array.from(this.actuators.values()).map(actuator => 
                                `<option value="${actuator.id}" ${actuator.id === action.actuator_id ? 'selected' : ''}>${actuator.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Action</label>
                        <select class="action-type" required>
                            <option value="">Sélectionner...</option>
                            <option value="turn_on" ${action.action === 'turn_on' ? 'selected' : ''}>Activer</option>
                            <option value="turn_off" ${action.action === 'turn_off' ? 'selected' : ''}>Désactiver</option>
                            <option value="toggle" ${action.action === 'toggle' ? 'selected' : ''}>Basculer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Durée (ms)</label>
                        <input type="number" class="action-duration" value="${action.duration || ''}" placeholder="Optionnel">
                    </div>
                    <button type="button" class="remove-btn" onclick="app.removeAction('${actionId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        actionsList.insertAdjacentHTML('beforeend', actionHtml);
    }

    removeCondition(conditionId) {
        const conditionElement = document.querySelector(`[data-condition-id="${conditionId}"]`);
        if (conditionElement) {
            conditionElement.remove();
        }
    }

    removeAction(actionId) {
        const actionElement = document.querySelector(`[data-action-id="${actionId}"]`);
        if (actionElement) {
            actionElement.remove();
        }
    }

    handleRuleSubmit() {
        this.pendingAction = 'save_rule';
        this.showRootPasswordModal();
    }

    async saveRule() {
        const ruleName = document.getElementById('ruleName').value;
        const triggerType = document.getElementById('triggerType').value;
        const enabled = document.getElementById('ruleEnabled').checked;
        
        const ruleData = {
            id: this.currentEditingRule || 'rule_' + Date.now(),
            name: ruleName,
            enabled: enabled,
            trigger_type: triggerType
        };

        // Collect conditions
        const conditions = [];
        document.querySelectorAll('.condition-item').forEach(item => {
            const sensorId = item.querySelector('.condition-sensor').value;
            const parameter = item.querySelector('.condition-parameter').value;
            const operator = item.querySelector('.condition-operator').value;
            const value = parseFloat(item.querySelector('.condition-value').value);
            const logic = item.querySelector('.condition-logic').value;
            
            if (sensorId && parameter && operator && !isNaN(value)) {
                const condition = {
                    sensor_id: sensorId,
                    parameter: parameter,
                    operator: operator,
                    value: value
                };
                
                if (logic) {
                    condition.logic = logic;
                }
                
                conditions.push(condition);
            }
        });
        ruleData.conditions = conditions;

        // Collect actions
        const actions = [];
        document.querySelectorAll('.action-item').forEach(item => {
            const actuatorId = item.querySelector('.action-actuator').value;
            const actionType = item.querySelector('.action-type').value;
            const duration = parseInt(item.querySelector('.action-duration').value);
            
            if (actuatorId && actionType) {
                const action = {
                    actuator_id: actuatorId,
                    action: actionType
                };
                if (!isNaN(duration) && duration > 0) {
                    action.duration = duration;
                }
                actions.push(action);
            }
        });
        ruleData.actions = actions;

        // Collect schedule if applicable
        if (triggerType === 'schedule') {
            const startTime = document.getElementById('startTime').value;
            const endTime = document.getElementById('endTime').value;
            const days = [];
            document.querySelectorAll('.day-checkbox input:checked').forEach(checkbox => {
                days.push(checkbox.value);
            });
            
            ruleData.schedule = {
                start_time: startTime,
                end_time: endTime,
                days: days
            };
        }

        try {
            // Get current config
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            
            // Update or add rule
            const ruleIndex = config.rules.findIndex(r => r.id === ruleData.id);
            if (ruleIndex >= 0) {
                config.rules[ruleIndex] = ruleData;
            } else {
                config.rules.push(ruleData);
            }
            
            // Save config
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `root_password=${encodeURIComponent(this.rootPassword)}&` +
                      encodeURIComponent(JSON.stringify(config))
            });

            const result = await response.json();
            if (result.success) {
                this.hideRuleModal();
                this.loadDevices(); // Reload all config
                this.showInternalNotification('Règle sauvegardée avec succès');
            } else {
                alert('Erreur lors de la sauvegarde: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving rule:', error);
            alert('Erreur de connexion');
        }
    }

    deleteRule(ruleId) {
        this.currentEditingRule = ruleId;
        this.pendingAction = 'delete_rule';
        this.showRootPasswordModal();
    }

    async performDeleteRule() {
        try {
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            
            config.rules = config.rules.filter(r => r.id !== this.currentEditingRule);
            
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `root_password=${encodeURIComponent(this.rootPassword)}&` +
                      encodeURIComponent(JSON.stringify(config))
            });

            const result = await response.json();
            if (result.success) {
                this.loadDevices(); // Reload all config
                this.showInternalNotification('Règle supprimée avec succès');
            } else {
                alert('Erreur lors de la suppression: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            alert('Erreur de connexion');
        }
    }

    updateParameterOptions(conditionId) {
        const conditionItem = document.querySelector(`[data-condition-id="${conditionId}"]`);
        const sensorSelect = conditionItem.querySelector('.condition-sensor');
        const parameterSelect = conditionItem.querySelector('.condition-parameter');
        
        const selectedOption = sensorSelect.options[sensorSelect.selectedIndex];
        const sensorType = selectedOption.dataset.type;
        
        parameterSelect.innerHTML = '';
        
        if (sensorType) {
            switch (sensorType) {
                case 'DHT11':
                    parameterSelect.innerHTML = `
                        <option value="temperature">Température</option>
                        <option value="humidity">Humidité</option>
                    `;
                    break;
                case 'MQ2':
                    parameterSelect.innerHTML = `<option value="gas">Gaz</option>`;
                    break;
                case 'ASC':
                    parameterSelect.innerHTML = `<option value="current">Courant</option>`;
                    break;
                case 'LDR':
                    parameterSelect.innerHTML = `<option value="light">Luminosité</option>`;
                    break;
                case 'PIR':
                    parameterSelect.innerHTML = `<option value="motion">Mouvement</option>`;
                    break;
                case 'BUTTON':
                    parameterSelect.innerHTML = `<option value="pressed">Appuyé</option>`;
                    break;
                default:
                    parameterSelect.innerHTML = `<option value="value">Valeur</option>`;
            }
        } else {
            parameterSelect.innerHTML = `<option value="">Choisir un capteur d'abord</option>`;
        }
    }

    getParameterDisplayName(parameter) {
        const displayNames = {
            'temperature': 'Température',
            'humidity': 'Humidité',
            'gas': 'Gaz',
            'current': 'Courant',
            'light': 'Luminosité',
            'motion': 'Mouvement',
            'pressed': 'Appuyé'
        };
        return displayNames[parameter] || parameter;
    }

    getSensorParameter(sensorId) {
        const sensor = this.sensors.get(sensorId);
        if (!sensor) return 'value';
        
        switch (sensor.sensor_type) {
            case 'DHT11': return 'temperature';
            case 'MQ2': return 'gas';
            case 'ASC': return 'current';
            case 'LDR': return 'light';
            case 'PIR': return 'motion';
            case 'BUTTON': return 'pressed';
            default: return 'value';
        }
    }

    loadRulesManagement() {
        const rulesList = document.getElementById('rulesList');
        rulesList.innerHTML = '';

        this.rules.forEach(rule => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'device-item';
            
            const triggerTypeText = this.getTriggerTypeText(rule.trigger_type);
            const statusText = rule.enabled ? 'Activée' : 'Désactivée';
            const conditionsCount = rule.conditions ? rule.conditions.length : 0;
            const actionsCount = rule.actions ? rule.actions.length : 0;
            
            ruleItem.innerHTML = `
                <div class="device-info">
                    <h4>${rule.name}</h4>
                    <p>${triggerTypeText} - ${conditionsCount} condition(s), ${actionsCount} action(s) - ${statusText}</p>
                </div>
                <div class="device-actions">
                    <button class="btn btn-secondary" onclick="app.showEditRuleModal('${rule.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteRule('${rule.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            `;
            
            rulesList.appendChild(ruleItem);
        });
    }

    getTriggerTypeText(triggerType) {
        const types = {
            'sensor_threshold': 'Seuil de capteur',
            'sensor_combination': 'Combinaison de capteurs',
            'schedule': 'Horaire programmé',
            'critical_event': 'Événement critique'
        };
        return types[triggerType] || triggerType;
    }

    startDataUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.authenticated) {
                this.updateSensorData();
            }
        }, 2000); // Update every 2 seconds
    }

    stopDataUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Global variable for app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new OpenDOMApp();
    window.startTime = Date.now();
});

// Add CSS for internal notifications
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.internal-notification {
    max-width: 300px;
    word-wrap: break-word;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
`;
document.head.appendChild(style);
