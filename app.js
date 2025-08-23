import { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    where,
    serverTimestamp
} from './firebase-config.js';

// DOM elements
const taskInput = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const addTaskBtn = document.getElementById('addTaskBtn');
const tasksContainer = document.getElementById('tasksContainer');
const allTasksContainer = document.getElementById('allTasksContainer');
const filterButtons = document.querySelectorAll('.filter-btn');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const pageTitle = document.getElementById('pageTitle');
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');

// Statistics elements
const totalTasksElement = document.getElementById('totalTasks');
const completedTasksElement = document.getElementById('completedTasks');
const activeTasksElement = document.getElementById('activeTasks');
const todayTasksElement = document.getElementById('todayTasks');

// Analytics elements
const analyticsTotalTasks = document.getElementById('analyticsTotalTasks');
const analyticsCompletedTasks = document.getElementById('analyticsCompletedTasks');
const analyticsCompletionRate = document.getElementById('analyticsCompletionRate');
const analyticsAvgCompletion = document.getElementById('analyticsAvgCompletion');

// Chart instances
let categoryChart, completionChart, productivityChart, timelineChart;

// Current user and filter state
window.currentUser = null;
window.currentFilter = 'all';
window.tasks = [];
window.unsubscribeTasks = null;

// Show notification
function showNotification(message, isSuccess = true) {
    notificationText.textContent = message;
    notification.className = `notification ${isSuccess ? 'success' : 'error'} show`;
    notification.querySelector('i').className = isSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const pageId = item.getAttribute('data-page');
        
        // Update active nav item
        navItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
        
        // Show the corresponding page
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageId}Page`).classList.add('active');
        
        // Update page title
        pageTitle.textContent = item.querySelector('span').textContent;
        
        // If navigating to analytics, update charts
        if (pageId === 'analytics') {
            updateAnalytics();
        }
    });
});

// Add task function
addTaskBtn.addEventListener('click', async () => {
    const taskText = taskInput.value.trim();
    const category = categorySelect.value;
    
    if (taskText !== '') {
        try {
            await addDoc(collection(db, 'tasks'), {
                userId: window.currentUser.uid,
                text: taskText,
                category: category,
                completed: false,
                createdAt: serverTimestamp(),
                completedAt: null
            });
            
            taskInput.value = '';
            showNotification('Task added successfully');
        } catch (error) {
            console.error('Error adding task:', error);
            showNotification('Error adding task: ' + error.message, false);
        }
    } else {
        showNotification('Please enter a task', false);
    }
});

// Filter tasks
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        window.currentFilter = button.getAttribute('data-filter');
        renderTasks();
    });
});

// Load tasks from Firestore
function loadTasks() {
    if (!window.currentUser) return;
    
    // Fixed: Removed orderBy to avoid index requirement
    const q = query(
        collection(db, 'tasks'), 
        where('userId', '==', window.currentUser.uid)
    );
    
    // Store the unsubscribe function
    window.unsubscribeTasks = onSnapshot(q, (snapshot) => {
        window.tasks = [];
        snapshot.forEach((doc) => {
            const taskData = doc.data();
            window.tasks.push({ 
                id: doc.id, 
                ...taskData,
                // Convert Firestore timestamps to Date objects if they exist
                createdAt: taskData.createdAt ? taskData.createdAt.toDate() : null,
                completedAt: taskData.completedAt ? taskData.completedAt.toDate() : null
            });
        });
        
        // Sort tasks by creation date manually (newest first)
        window.tasks.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt - a.createdAt;
        });
        
        renderTasks();
        updateAnalytics();
    }, (error) => {
        // Don't show error when user is signed out (permissions error)
        if (error.code !== 'permission-denied' && error.code !== 'missing-or-insufficient-permissions') {
            console.error('Error loading tasks:', error);
            showNotification('Error loading tasks: ' + error.message, false);
        }
    });
}

// Render tasks based on current filter
function renderTasks() {
    tasksContainer.innerHTML = '';
    allTasksContainer.innerHTML = '';
    let totalTasks = 0;
    let completedTasks = 0;
    
    const filteredTasks = window.tasks.filter(task => {
        if (window.currentFilter === 'all') return true;
        if (window.currentFilter === 'active') return !task.completed;
        if (window.currentFilter === 'completed') return task.completed;
        return task.category === window.currentFilter;
    });
    
    // Show only 5 recent tasks on dashboard
    const recentTasks = window.currentFilter === 'all' ? filteredTasks.slice(0, 5) : filteredTasks;
    
    // Render tasks for dashboard
    renderTaskList(recentTasks, tasksContainer);
    
    // Render all tasks for tasks page
    renderTaskList(filteredTasks, allTasksContainer);
    
    // Update stats
    window.tasks.forEach(task => {
        totalTasks++;
        if (task.completed) completedTasks++;
    });
    
    updateStats(totalTasks, completedTasks, totalTasks - completedTasks);
}

// Helper function to render task list
function renderTaskList(taskList, container) {
    if (taskList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <i class="fas fa-tasks" style="font-size: 48px; margin-bottom: 16px;"></i>
                <h3>No tasks found</h3>
                <p>${window.currentFilter === 'all' ? 'Get started by adding a new task!' : 'No tasks match your current filter'}</p>
            </div>
        `;
        return;
    }
    
    taskList.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item category-${task.category} ${task.completed ? 'completed' : ''}`;
        taskElement.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-text">${task.text}</div>
                <div class="task-category">${task.category}</div>
                ${task.createdAt ? `<div style="font-size: 12px; color: var(--gray); margin-top: 5px;">
                    Added: ${formatDate(task.createdAt)}
                </div>` : ''}
            </div>
            <div class="task-actions">
                <button class="task-btn edit"><i class="fas fa-edit"></i></button>
                <button class="task-btn delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Toggle completion status
        const checkbox = taskElement.querySelector('.task-checkbox');
        checkbox.addEventListener('change', async () => {
            try {
                await updateDoc(doc(db, 'tasks', task.id), {
                    completed: checkbox.checked,
                    completedAt: checkbox.checked ? serverTimestamp() : null
                });
                showNotification('Task updated successfully');
            } catch (error) {
                console.error('Error updating task:', error);
                showNotification('Error updating task: ' + error.message, false);
            }
        });
        
        // Delete task
        const deleteBtn = taskElement.querySelector('.delete');
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await deleteDoc(doc(db, 'tasks', task.id));
                    showNotification('Task deleted successfully');
                } catch (error) {
                    console.error('Error deleting task:', error);
                    showNotification('Error deleting task: ' + error.message, false);
                }
            }
        });
        
        // Edit task
        const editBtn = taskElement.querySelector('.edit');
        editBtn.addEventListener('click', async () => {
            const newText = prompt('Edit task:', task.text);
            if (newText !== null && newText.trim() !== '') {
                try {
                    await updateDoc(doc(db, 'tasks', task.id), {
                        text: newText.trim()
                    });
                    showNotification('Task updated successfully');
                } catch (error) {
                    console.error('Error updating task:', error);
                    showNotification('Error updating task: ' + error.message, false);
                }
            }
        });
        
        container.appendChild(taskElement);
    });
}

// Format date for display
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Update statistics
function updateStats(total, completed, active) {
    totalTasksElement.textContent = total;
    completedTasksElement.textContent = completed;
    activeTasksElement.textContent = active;
    
    // Calculate tasks due today (for demo purposes, we'll use a random number)
    const todayCount = window.tasks.filter(task => {
        if (!task.createdAt) return false;
        const createdDate = new Date(task.createdAt);
        const today = new Date();
        return createdDate.getDate() === today.getDate() &&
               createdDate.getMonth() === today.getMonth() &&
               createdDate.getFullYear() === today.getFullYear();
    }).length;
    
    todayTasksElement.textContent = todayCount;
}

// Update analytics
function updateAnalytics() {
    if (window.tasks.length === 0) {
        // Show empty state for analytics
        analyticsTotalTasks.textContent = "0";
        analyticsCompletedTasks.textContent = "0";
        analyticsCompletionRate.textContent = "0%";
        analyticsAvgCompletion.textContent = "0";
        return;
    }
    
    const totalTasks = window.tasks.length;
    const completedTasks = window.tasks.filter(task => task.completed).length;
    const completionRate = Math.round((completedTasks / totalTasks) * 100);
    
    // Calculate average completion time in days
    let totalCompletionTime = 0;
    let completedTasksWithTime = 0;
    
    window.tasks.forEach(task => {
        if (task.completed && task.createdAt && task.completedAt) {
            const created = new Date(task.createdAt);
            const completed = new Date(task.completedAt);
            const diffTime = Math.abs(completed - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            totalCompletionTime += diffDays;
            completedTasksWithTime++;
        }
    });
    
    const avgCompletionTime = completedTasksWithTime > 0 
        ? Math.round(totalCompletionTime / completedTasksWithTime) 
        : 0;
    
    // Update analytics stats
    analyticsTotalTasks.textContent = totalTasks;
    analyticsCompletedTasks.textContent = completedTasks;
    analyticsCompletionRate.textContent = `${completionRate}%`;
    analyticsAvgCompletion.textContent = avgCompletionTime;
    
    // Update charts
    updateCharts();
}

// Get tasks completed by day for the current week
function getWeeklyProductivityData() {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek);
    
    const weekData = Array(7).fill(0);
    
    window.tasks.forEach(task => {
        if (task.completed && task.completedAt) {
            const completedDate = new Date(task.completedAt);
            // Check if task was completed this week
            if (completedDate >= startDate && completedDate <= today) {
                const dayIndex = completedDate.getDay();
                weekData[dayIndex]++;
            }
        }
    });
    
    // Reorder to start with Monday
    const reorderedData = [...weekData.slice(1), weekData[0]];
    const reorderedLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return {
        labels: reorderedLabels,
        data: reorderedData
    };
}

// Get tasks created over the past 6 months
function getTasksOverTimeData() {
    const months = [];
    const monthData = [];
    const now = new Date();
    
    // Generate labels for the past 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }
    
    // Initialize month data with zeros
    for (let i = 0; i < 6; i++) {
        monthData.push(0);
    }
    
    // Count tasks by month
    window.tasks.forEach(task => {
        if (task.createdAt) {
            const createdDate = new Date(task.createdAt);
            const monthDiff = (now.getFullYear() - createdDate.getFullYear()) * 12 + (now.getMonth() - createdDate.getMonth());
            
            if (monthDiff >= 0 && monthDiff < 6) {
                monthData[5 - monthDiff]++;
            }
        }
    });
    
    return {
        labels: months,
        data: monthData
    };
}

// Update analytics charts
function updateCharts() {
    // Tasks by category
    const categoryCount = {
        work: 0,
        personal: 0,
        shopping: 0,
        health: 0,
        education: 0
    };
    
    window.tasks.forEach(task => {
        if (categoryCount.hasOwnProperty(task.category)) {
            categoryCount[task.category]++;
        }
    });
    
    // Get weekly productivity data
    const weeklyData = getWeeklyProductivityData();
    
    // Get tasks over time data
    const timeData = getTasksOverTimeData();
    
    // Destroy existing charts if they exist
    if (categoryChart) categoryChart.destroy();
    if (completionChart) completionChart.destroy();
    if (productivityChart) productivityChart.destroy();
    if (timelineChart) timelineChart.destroy();
    
    // Tasks by Category Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['Work', 'Personal', 'Shopping', 'Health', 'Education'],
            datasets: [{
                data: [
                    categoryCount.work,
                    categoryCount.personal,
                    categoryCount.shopping,
                    categoryCount.health,
                    categoryCount.education
                ],
                backgroundColor: [
                    '#6C63FF',
                    '#36D6C3',
                    '#FF6B8B',
                    '#10B981',
                    '#F59E0B'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Completion Status Chart
    const completionCtx = document.getElementById('completionChart').getContext('2d');
    completionChart = new Chart(completionCtx, {
        type: 'pie',
        data: {
            labels: ['Completed', 'Active'],
            datasets: [{
                data: [
                    window.tasks.filter(task => task.completed).length,
                    window.tasks.filter(task => !task.completed).length
                ],
                backgroundColor: [
                    '#10B981',
                    '#6C63FF'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Weekly Productivity Chart (using actual data)
    const productivityCtx = document.getElementById('productivityChart').getContext('2d');
    productivityChart = new Chart(productivityCtx, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [{
                label: 'Tasks Completed',
                data: weeklyData.data,
                backgroundColor: '#6C63FF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tasks Completed'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Day of Week'
                    }
                }
            }
        }
    });
    
    // Tasks Over Time Chart (using actual data)
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: timeData.labels,
            datasets: [{
                label: 'Tasks Created',
                data: timeData.data,
                borderColor: '#6C63FF',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(108, 99, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tasks Created'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            }
        }
    });
}

// Allow adding task with Enter key
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTaskBtn.click();
    }
});

// Initialize charts when the page loads
setTimeout(() => {
    if (document.getElementById('analyticsPage').classList.contains('active')) {
        updateAnalytics();
    }
}, 1000);

// Make functions available globally
window.showNotification = showNotification;
window.loadTasks = loadTasks;
window.renderTasks = renderTasks;
window.updateStats = updateStats;
window.updateAnalytics = updateAnalytics;