/**
 * MindKeep Meal Planner Module
 * 
 * A comprehensive meal planning system with:
 * - Weekly meal calendar
 * - Meal database with recipes
 * - Shopping list generation
 * - Meal categorization
 * - Random meal suggestions
 */

class MealPlanner {
    constructor() {
        this.meals = new Map(); // mealId -> meal object
        this.weeklyPlan = new Map(); // date -> {breakfast, lunch, dinner, snacks}
        this.currentWeekStart = this.getWeekStart(new Date());
        this.currentFilter = 'all';
        this.initializeMealPlanner();
    }

    initializeMealPlanner() {
        try {
            this.loadMealData();
            this.setupDefaultMeals();
        } catch (error) {
            console.warn('MealPlanner initialization error:', error);
        }
    }

    async loadMealData() {
        try {
            // Load from JSON files via electron API
            const savedMeals = await window.electronAPI.getMeals();
            const savedPlans = await window.electronAPI.getMealPlans();

            if (savedMeals && Array.isArray(savedMeals)) {
                savedMeals.forEach(meal => this.meals.set(meal.id, meal));
            }

            if (savedPlans && Array.isArray(savedPlans)) {
                savedPlans.forEach(plan => {
                    this.weeklyPlan.set(plan.date, plan.meals);
                });
            }
        } catch (error) {
            console.warn('Error loading meal data:', error);
            // Fallback to localStorage if electron API not available
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        try {
            const savedMeals = localStorage.getItem('mindkeep_meals');
            const savedPlans = localStorage.getItem('mindkeep_meal_plans');

            if (savedMeals) {
                const mealsArray = JSON.parse(savedMeals);
                mealsArray.forEach(meal => this.meals.set(meal.id, meal));
            }

            if (savedPlans) {
                const plansArray = JSON.parse(savedPlans);
                plansArray.forEach(plan => {
                    this.weeklyPlan.set(plan.date, plan.meals);
                });
            }
        } catch (error) {
            console.warn('Error loading from localStorage:', error);
        }
    }

    async saveMealData() {
        try {
            const mealsArray = Array.from(this.meals.values());
            const plansArray = Array.from(this.weeklyPlan.entries()).map(([date, meals]) => ({
                date,
                meals
            }));

            // Save to JSON files via electron API
            await window.electronAPI.saveMeals(mealsArray);
            await window.electronAPI.saveMealPlans(plansArray);
        } catch (error) {
            console.warn('Error saving meal data:', error);
            // Fallback to localStorage
            this.saveToLocalStorage();
        }
    }

    saveToLocalStorage() {
        try {
            const mealsArray = Array.from(this.meals.values());
            const plansArray = Array.from(this.weeklyPlan.entries()).map(([date, meals]) => ({
                date,
                meals
            }));

            localStorage.setItem('mindkeep_meals', JSON.stringify(mealsArray));
            localStorage.setItem('mindkeep_meal_plans', JSON.stringify(plansArray));
        } catch (error) {
            console.warn('Error saving to localStorage:', error);
        }
    }

    setupDefaultMeals() {
        // No default meals - start with empty meal database
    }

    createMeal(mealData) {
        const meal = {
            id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: mealData.name,
            category: mealData.category || 'dinner',
            prepTime: mealData.prepTime || 30,
            servings: mealData.servings || 4,
            ingredients: Array.isArray(mealData.ingredients) ? mealData.ingredients : 
                        mealData.ingredients.split('\n').filter(i => i.trim()),
            instructions: mealData.instructions || '',
            notes: mealData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.meals.set(meal.id, meal);
        this.saveMealData();
        return meal;
    }

    deleteMeal(mealId) {
        if (this.meals.has(mealId)) {
            this.meals.delete(mealId);
            
            // Remove from any meal plans
            this.weeklyPlan.forEach((dayMeals, date) => {
                Object.keys(dayMeals).forEach(mealType => {
                    if (dayMeals[mealType] === mealId) {
                        dayMeals[mealType] = null;
                    }
                });
            });
            
            this.saveMealData();
            this.refreshMealPlannerView();
        }
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to get Monday as start of week
        return new Date(d.setDate(diff));
    }

    getWeekDates(weekStart) {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            dates.push(date);
        }
        return dates;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    assignMealToDay(date, mealType, mealId) {
        const dateStr = this.formatDate(date);
        
        if (!this.weeklyPlan.has(dateStr)) {
            this.weeklyPlan.set(dateStr, {
                breakfast: null,
                lunch: null,
                dinner: null,
                snacks: []
            });
        }

        const dayMeals = this.weeklyPlan.get(dateStr);
        
        if (mealType === 'snacks') {
            if (!dayMeals.snacks.includes(mealId)) {
                dayMeals.snacks.push(mealId);
            }
        } else {
            dayMeals[mealType] = mealId;
        }

        this.saveMealData();
        this.refreshCalendarView();
    }

    removeMealFromDay(date, mealType, mealId = null) {
        const dateStr = this.formatDate(date);
        const dayMeals = this.weeklyPlan.get(dateStr);
        
        if (dayMeals) {
            if (mealType === 'snacks' && mealId) {
                dayMeals.snacks = dayMeals.snacks.filter(id => id !== mealId);
            } else {
                dayMeals[mealType] = null;
            }
            
            this.saveMealData();
            this.refreshCalendarView();
        }
    }

    generateRandomPlan() {
        const weekDates = this.getWeekDates(this.currentWeekStart);
        const mealsByCategory = this.getMealsByCategory();

        weekDates.forEach(date => {
            const dateStr = this.formatDate(date);
            
            // Generate random meals for each category
            const dayPlan = {
                breakfast: this.getRandomMeal(mealsByCategory.breakfast),
                lunch: this.getRandomMeal(mealsByCategory.lunch),
                dinner: this.getRandomMeal(mealsByCategory.dinner),
                snacks: [this.getRandomMeal(mealsByCategory.snack)].filter(Boolean)
            };

            this.weeklyPlan.set(dateStr, dayPlan);
        });

        this.saveMealData();
        this.refreshCalendarView();
    }

    getMealsByCategory() {
        const categories = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: []
        };

        this.meals.forEach(meal => {
            if (categories[meal.category]) {
                categories[meal.category].push(meal.id);
            }
        });

        return categories;
    }

    getRandomMeal(mealIds) {
        if (!mealIds || mealIds.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * mealIds.length);
        return mealIds[randomIndex];
    }

    generateShoppingList() {
        const weekDates = this.getWeekDates(this.currentWeekStart);
        const ingredients = new Map(); // ingredient -> quantity info

        weekDates.forEach(date => {
            const dateStr = this.formatDate(date);
            const dayMeals = this.weeklyPlan.get(dateStr);
            
            if (dayMeals) {
                // Process all meal types
                ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
                    if (dayMeals[mealType]) {
                        const meal = this.meals.get(dayMeals[mealType]);
                        if (meal) {
                            meal.ingredients.forEach(ingredient => {
                                const key = ingredient.toLowerCase().trim();
                                if (ingredients.has(key)) {
                                    ingredients.get(key).count++;
                                } else {
                                    ingredients.set(key, {
                                        original: ingredient,
                                        count: 1,
                                        meals: [meal.name]
                                    });
                                }
                            });
                        }
                    }
                });

                // Process snacks
                if (dayMeals.snacks) {
                    dayMeals.snacks.forEach(snackId => {
                        const snack = this.meals.get(snackId);
                        if (snack) {
                            snack.ingredients.forEach(ingredient => {
                                const key = ingredient.toLowerCase().trim();
                                if (ingredients.has(key)) {
                                    ingredients.get(key).count++;
                                } else {
                                    ingredients.set(key, {
                                        original: ingredient,
                                        count: 1,
                                        meals: [snack.name]
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });

        return Array.from(ingredients.values()).sort((a, b) => 
            a.original.localeCompare(b.original)
        );
    }

    refreshMealPlannerView() {
        if (document.getElementById('mealPlannerView').classList.contains('active')) {
            this.renderSavedMeals();
            this.refreshCalendarView();
        }
    }

    refreshCalendarView() {
        this.renderCalendar();
        this.updateWeekTitle();
    }

    renderSavedMeals() {
        const container = document.getElementById('savedMealsList');
        if (!container) return;

        const filteredMeals = Array.from(this.meals.values()).filter(meal => 
            this.currentFilter === 'all' || meal.category === this.currentFilter
        );

        if (filteredMeals.length === 0) {
            container.innerHTML = `
                <div class="no-meals-message">
                    <div class="no-meals-icon">🍽️</div>
                    <p>No meals found</p>
                    <button onclick="showAddMealModal()" class="meal-btn primary">Add Meal</button>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredMeals.map(meal => this.renderMealItem(meal)).join('');
    }

    renderMealItem(meal) {
        const categoryIcons = {
            breakfast: '🌅',
            lunch: '🌞',
            dinner: '🌙',
            snack: '🍿'
        };

        return `
            <div class="saved-meal-item" data-meal-id="${meal.id}" draggable="true" 
                 ondragstart="handleMealDragStart(event)" ondragend="handleMealDragEnd(event)">
                <div class="meal-item-header">
                    <span class="meal-category-icon">${categoryIcons[meal.category] || '🍽️'}</span>
                    <h4 class="meal-item-title">${meal.name}</h4>
                    <div class="meal-item-actions">
                        <button class="meal-action-btn" onclick="editMeal('${meal.id}')" title="Edit">✏️</button>
                        <button class="meal-action-btn" onclick="deleteMealConfirm('${meal.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="meal-item-meta">
                    <span class="meal-prep-time">⏱️ ${meal.prepTime}min</span>
                    <span class="meal-servings">👥 ${meal.servings}</span>
                </div>
                <div class="meal-ingredients-preview">
                    ${meal.ingredients.slice(0, 3).join(', ')}${meal.ingredients.length > 3 ? '...' : ''}
                </div>
            </div>
        `;
    }

    renderCalendar() {
        const container = document.getElementById('mealCalendar');
        if (!container) return;

        const weekDates = this.getWeekDates(this.currentWeekStart);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        container.innerHTML = weekDates.map((date, index) => {
            const dateStr = this.formatDate(date);
            const dayMeals = this.weeklyPlan.get(dateStr) || {
                breakfast: null,
                lunch: null,
                dinner: null,
                snacks: []
            };

            return `
                <div class="calendar-day" data-date="${dateStr}">
                    <div class="day-header">
                        <h4>${dayNames[index]}</h4>
                        <span class="day-date">${date.getDate()}/${date.getMonth() + 1}</span>
                    </div>
                    
                    <div class="day-meals">
                        ${this.renderDayMealSlot('breakfast', '🌅', dayMeals.breakfast, dateStr)}
                        ${this.renderDayMealSlot('lunch', '🌞', dayMeals.lunch, dateStr)}
                        ${this.renderDayMealSlot('dinner', '🌙', dayMeals.dinner, dateStr)}
                        ${this.renderSnacksSlot(dayMeals.snacks, dateStr)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDayMealSlot(mealType, icon, mealId, dateStr) {
        const meal = mealId ? this.meals.get(mealId) : null;
        
        return `
            <div class="meal-slot ${mealType}" 
                 ondragover="handleMealSlotDragOver(event)" 
                 ondragleave="handleMealSlotDragLeave(event)"
                 ondrop="handleMealSlotDrop(event, '${dateStr}', '${mealType}')">
                <div class="meal-slot-header">
                    <span class="meal-type-icon">${icon}</span>
                    <span class="meal-type-name">${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</span>
                </div>
                ${meal ? `
                    <div class="assigned-meal" onclick="viewMealDetails('${meal.id}')">
                        <span class="assigned-meal-name">${meal.name}</span>
                        <button class="remove-meal-btn" onclick="removeMealFromSlot('${dateStr}', '${mealType}'); event.stopPropagation();">×</button>
                    </div>
                ` : `
                    <div class="empty-meal-slot">
                        <span class="drop-hint">Drop meal here</span>
                    </div>
                `}
            </div>
        `;
    }

    renderSnacksSlot(snackIds, dateStr) {
        const snacks = snackIds.map(id => this.meals.get(id)).filter(Boolean);
        
        return `
            <div class="meal-slot snacks" 
                 ondragover="handleMealSlotDragOver(event)" 
                 ondragleave="handleMealSlotDragLeave(event)"
                 ondrop="handleMealSlotDrop(event, '${dateStr}', 'snacks')">
                <div class="meal-slot-header">
                    <span class="meal-type-icon">🍿</span>
                    <span class="meal-type-name">Snacks</span>
                </div>
                ${snacks.length > 0 ? `
                    <div class="assigned-snacks">
                        ${snacks.map(snack => `
                            <div class="assigned-snack" onclick="viewMealDetails('${snack.id}')">
                                <span class="assigned-meal-name">${snack.name}</span>
                                <button class="remove-meal-btn" onclick="removeMealFromSlot('${dateStr}', 'snacks', '${snack.id}'); event.stopPropagation();">×</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-meal-slot">
                        <span class="drop-hint">Drop snacks here</span>
                    </div>
                `}
            </div>
        `;
    }

    updateWeekTitle() {
        const titleElement = document.getElementById('currentWeekTitle');
        if (!titleElement) return;

        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const startStr = this.currentWeekStart.toLocaleDateString();
        const endStr = weekEnd.toLocaleDateString();
        
        titleElement.textContent = `${startStr} - ${endStr}`;
    }

    navigateWeek(direction) {
        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
        this.currentWeekStart = newWeekStart;
        
        this.refreshCalendarView();
    }

    filterMealsByCategory(category) {
        this.currentFilter = category;
        
        // Update filter buttons
        document.querySelectorAll('.meal-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        
        this.renderSavedMeals();
    }
}

// Initialize meal planner
let mealPlanner;

// Meal categories collapse functionality
function toggleMealCategoriesCollapse() {
    const categoriesFilters = document.getElementById('mealCategoryFilters');
    const collapseArrow = document.getElementById('mealCategoriesCollapseArrow');
    
    if (categoriesFilters && collapseArrow) {
        const isCollapsed = categoriesFilters.classList.contains('collapsed');
        
        if (isCollapsed) {
            categoriesFilters.classList.remove('collapsed');
            collapseArrow.classList.remove('collapsed');
            collapseArrow.textContent = '▼';
        } else {
            categoriesFilters.classList.add('collapsed');
            collapseArrow.classList.add('collapsed');
            collapseArrow.textContent = '▶';
        }
    }
}

// Global functions for meal planner
function showMealPlannerView() {
    document.getElementById('notesTab').classList.remove('active');
    document.getElementById('tasksTab').classList.remove('active');
    document.getElementById('mealPlannerTab').classList.add('active');
    document.getElementById('notesView').classList.remove('active');
    document.getElementById('tasksView').classList.remove('active');
    document.getElementById('mealPlannerView').classList.add('active');

    // Hide search bar in meal planner view
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.style.display = 'none';
    }

    // Initialize meal planner if not already done
    if (!mealPlanner) {
        mealPlanner = new MealPlanner();
    }

    // Refresh the view
    mealPlanner.refreshMealPlannerView();
}

function showAddMealModal() {
    document.getElementById('addMealModal').style.display = 'flex';
    document.getElementById('mealName').focus();
}

function closeAddMealModal() {
    document.getElementById('addMealModal').style.display = 'none';
    // Clear form
    document.getElementById('mealName').value = '';
    document.getElementById('mealCategory').value = 'dinner';
    document.getElementById('mealPrepTime').value = '';
    document.getElementById('mealServings').value = '4';
    document.getElementById('mealIngredients').value = '';
    document.getElementById('mealInstructions').value = '';
    document.getElementById('mealNotes').value = '';
}

function saveMeal() {
    const name = document.getElementById('mealName').value.trim();
    const category = document.getElementById('mealCategory').value;
    const prepTime = parseInt(document.getElementById('mealPrepTime').value) || 30;
    const servings = parseInt(document.getElementById('mealServings').value) || 4;
    const ingredients = document.getElementById('mealIngredients').value.trim();
    const instructions = document.getElementById('mealInstructions').value.trim();
    const notes = document.getElementById('mealNotes').value.trim();

    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a meal name.');
        return;
    }

    if (!ingredients) {
        showAlert('⚠️ Warning', 'Please enter at least one ingredient.');
        return;
    }

    const mealData = {
        name,
        category,
        prepTime,
        servings,
        ingredients,
        instructions,
        notes
    };

    mealPlanner.createMeal(mealData);
    mealPlanner.refreshMealPlannerView();
    closeAddMealModal();
    showAlert('✅ Success', 'Meal saved successfully!');
}

function deleteMealConfirm(mealId) {
    const meal = mealPlanner.meals.get(mealId);
    if (!meal) return;

    showConfirm(
        'Delete Meal',
        `Are you sure you want to delete "${meal.name}"? This will also remove it from any meal plans.`,
        () => {
            mealPlanner.deleteMeal(mealId);
            showAlert('✅ Success', 'Meal deleted successfully!');
        },
        'Delete Meal',
        '🗑️'
    );
}

function generateWeeklyPlan() {
    showConfirm(
        'Generate Weekly Plan',
        'This will replace your current meal plan with randomly selected meals. Continue?',
        () => {
            mealPlanner.generateRandomPlan();
            showAlert('✅ Success', 'Weekly meal plan generated!');
        },
        'Generate Plan',
        '🎲'
    );
}

function generateShoppingList() {
    const shoppingList = mealPlanner.generateShoppingList();
    
    if (shoppingList.length === 0) {
        showAlert('ℹ️ Info', 'No meals planned for this week. Add some meals to your calendar first!');
        return;
    }

    // Update shopping list modal
    const weekTitle = document.getElementById('currentWeekTitle').textContent;
    document.getElementById('shoppingListWeek').textContent = weekTitle;
    
    const container = document.getElementById('shoppingListItems');
    container.innerHTML = shoppingList.map(item => `
        <div class="shopping-list-item">
            <input type="checkbox" class="shopping-item-checkbox">
            <span class="shopping-item-text">${item.original}</span>
            ${item.count > 1 ? `<span class="shopping-item-count">(${item.count}x)</span>` : ''}
        </div>
    `).join('');

    document.getElementById('shoppingListModal').style.display = 'flex';
}

function closeShoppingListModal() {
    document.getElementById('shoppingListModal').style.display = 'none';
}

function exportShoppingList() {
    const shoppingList = mealPlanner.generateShoppingList();
    const weekTitle = document.getElementById('currentWeekTitle').textContent;
    
    const content = `Shopping List - ${weekTitle}\n\n` +
        shoppingList.map(item => `☐ ${item.original}${item.count > 1 ? ` (${item.count}x)` : ''}`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function filterMealsByCategory(category) {
    if (mealPlanner) {
        mealPlanner.filterMealsByCategory(category);
    }
}

function navigateWeek(direction) {
    if (mealPlanner) {
        mealPlanner.navigateWeek(direction);
    }
}

// Drag and drop functionality
let draggedMealId = null;

function handleMealDragStart(event) {
    const mealItem = event.target.closest('.saved-meal-item');
    draggedMealId = mealItem.dataset.mealId;
    mealItem.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'copy';
}

function handleMealDragEnd(event) {
    const mealItem = event.target.closest('.saved-meal-item');
    mealItem.classList.remove('dragging');
    draggedMealId = null;
}

function handleMealSlotDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('drag-over');
}

function handleMealSlotDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleMealSlotDrop(event, dateStr, mealType) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    if (draggedMealId && mealPlanner) {
        const date = new Date(dateStr);
        mealPlanner.assignMealToDay(date, mealType, draggedMealId);
    }
}

function removeMealFromSlot(dateStr, mealType, mealId = null) {
    if (mealPlanner) {
        const date = new Date(dateStr);
        mealPlanner.removeMealFromDay(date, mealType, mealId);
    }
}

function viewMealDetails(mealId) {
    const meal = mealPlanner.meals.get(mealId);
    if (!meal) return;

    const categoryIcons = {
        breakfast: '🌅',
        lunch: '🌞',
        dinner: '🌙',
        snack: '🍿'
    };

    showEnhancedModal(
        `${categoryIcons[meal.category] || '🍽️'} ${meal.name}`,
        `
        <div class="meal-details">
            <div class="meal-meta">
                <span class="meal-detail-item">⏱️ Prep Time: ${meal.prepTime} minutes</span>
                <span class="meal-detail-item">👥 Servings: ${meal.servings}</span>
                <span class="meal-detail-item">📂 Category: ${meal.category}</span>
            </div>
            
            <div class="meal-section">
                <h4>🛒 Ingredients:</h4>
                <ul class="ingredients-list">
                    ${meal.ingredients.map(ingredient => `<li>${ingredient}</li>`).join('')}
                </ul>
            </div>
            
            ${meal.instructions ? `
                <div class="meal-section">
                    <h4>👨‍🍳 Instructions:</h4>
                    <p class="instructions-text">${meal.instructions.replace(/\n/g, '<br>')}</p>
                </div>
            ` : ''}
            
            ${meal.notes ? `
                <div class="meal-section">
                    <h4>📝 Notes:</h4>
                    <p class="notes-text">${meal.notes}</p>
                </div>
            ` : ''}
        </div>
        `,
        [
            { text: '✏️ Edit', action: () => editMeal(mealId), style: 'primary' },
            { text: 'Close', action: () => {} }
        ]
    );
}

function editMeal(mealId) {
    const meal = mealPlanner.meals.get(mealId);
    if (!meal) return;

    // Pre-fill the form with current meal data
    document.getElementById('mealName').value = meal.name;
    document.getElementById('mealCategory').value = meal.category;
    document.getElementById('mealPrepTime').value = meal.prepTime;
    document.getElementById('mealServings').value = meal.servings;
    document.getElementById('mealIngredients').value = meal.ingredients.join('\n');
    document.getElementById('mealInstructions').value = meal.instructions;
    document.getElementById('mealNotes').value = meal.notes;

    // Change modal title and save function
    document.querySelector('#addMealModal h3').textContent = '✏️ Edit Meal';
    document.querySelector('#addMealModal .modal-btn.save').textContent = 'Update Meal';
    document.querySelector('#addMealModal .modal-btn.save').onclick = () => updateMeal(mealId);

    showAddMealModal();
}

function updateMeal(mealId) {
    const meal = mealPlanner.meals.get(mealId);
    if (!meal) return;

    const name = document.getElementById('mealName').value.trim();
    const category = document.getElementById('mealCategory').value;
    const prepTime = parseInt(document.getElementById('mealPrepTime').value) || 30;
    const servings = parseInt(document.getElementById('mealServings').value) || 4;
    const ingredients = document.getElementById('mealIngredients').value.trim();
    const instructions = document.getElementById('mealInstructions').value.trim();
    const notes = document.getElementById('mealNotes').value.trim();

    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a meal name.');
        return;
    }

    if (!ingredients) {
        showAlert('⚠️ Warning', 'Please enter at least one ingredient.');
        return;
    }

    // Update meal properties
    meal.name = name;
    meal.category = category;
    meal.prepTime = prepTime;
    meal.servings = servings;
    meal.ingredients = ingredients.split('\n').filter(i => i.trim());
    meal.instructions = instructions;
    meal.notes = notes;
    meal.updatedAt = new Date().toISOString();

    mealPlanner.saveMealData();
    mealPlanner.refreshMealPlannerView();

    // Reset modal for next use
    document.querySelector('#addMealModal h3').textContent = '🍽️ Add New Meal';
    document.querySelector('#addMealModal .modal-btn.save').textContent = 'Save Meal';
    document.querySelector('#addMealModal .modal-btn.save').onclick = saveMeal;

    closeAddMealModal();
    showAlert('✅ Success', 'Meal updated successfully!');
}

// Initialize meal planner when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize meal planner after a short delay to ensure other systems are ready
    setTimeout(() => {
        if (!mealPlanner) {
            mealPlanner = new MealPlanner();
        }
    }, 1000);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MealPlanner;
} else {
    window.MealPlanner = MealPlanner;
}