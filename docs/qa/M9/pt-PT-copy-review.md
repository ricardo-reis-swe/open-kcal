# pt-PT copy review (M9, ROAD-02)

For the user to review. Every UI string in `en` and `pt-PT` (ARCH-22, SCOPE-12); source files `src/shared/i18n/locales/{en,pt-PT}.json`. Rows identical in both languages (units, brand names, pure placeholders such as `{{value}} {{unit}}`, "Total", "Volume") are left out. `{{…}}` are placeholders filled in by the app.

275 strings to review. Mark changes inline or tell Claude the key and the new text.

| Key | English | pt-PT |
|---|---|---|
| **common** | | |
| `common.cancel` | Cancel | Cancelar |
| `common.close` | Close | Fechar |
| `common.back` | Back | Voltar |
| `common.notFound` | This item no longer exists. | Este item já não existe. |
| `common.backToDiary` | Back to Diary | Voltar ao diário |
| **tabs** | | |
| `tabs.diary` | Diary | Diário |
| `tabs.profile` | Profile | Perfil |
| `tabs.add` | Add | Adicionar |
| **diary** | | |
| `diary.title` | Diary | Diário |
| `diary.chooseDate` | Choose date | Escolher data |
| `diary.yesterday` | Yesterday | Ontem |
| `diary.today` | Today | Hoje |
| `diary.tomorrow` | Tomorrow | Amanhã |
| `diary.goToToday` | Today | Hoje |
| `diary.goToTodayLabel` | Go to today | Ir para hoje |
| `diary.previousDay` | Previous day, {{label}} | Dia anterior, {{label}} |
| `diary.nextDay` | Next day, {{label}} | Dia seguinte, {{label}} |
| `diary.selectedDay` | Showing {{label}} | A mostrar {{label}} |
| `diary.units.kcalSpoken` | kilocalories | quilocalorias |
| `diary.units.kJSpoken` | kilojoules | quilojoules |
| `diary.ring.left` | {{unit}} left | {{unit}} restantes |
| `diary.ring.over` | {{unit}} over | {{unit}} a mais |
| `diary.ring.eaten` | {{value}} eaten | {{value}} consumidas |
| `diary.ring.eatenNoGoal` | {{unit}} eaten | {{unit}} consumidas |
| `diary.ring.noGoal` | No goal for this date | Sem objetivo para esta data |
| `diary.ring.a11yLeft` | Calories remaining, {{remaining}} of {{goal}} {{unit}}. {{eaten}} eaten. | Calorias restantes, {{remaining}} de {{goal}} {{unit}}. {{eaten}} consumidas. |
| `diary.ring.a11yOver` | Over calorie goal by {{over}} {{unit}}. Goal {{goal}}, {{eaten}} eaten. | Acima do objetivo de calorias em {{over}} {{unit}}. Objetivo {{goal}}, {{eaten}} consumidas. |
| `diary.ring.a11yNoGoal` | Calories eaten, {{eaten}} {{unit}}. No goal for this date. | Calorias consumidas, {{eaten}} {{unit}}. Sem objetivo para esta data. |
| `diary.macros.carbs` | Carbs | Hidratos |
| `diary.macros.protein` | Protein | Proteína |
| `diary.macros.fat` | Fat | Gordura |
| `diary.macros.a11y` | {{macro}}, {{consumed}} of {{target}} grams. | {{macro}}, {{consumed}} de {{target}} gramas. |
| `diary.macros.a11yNoGoal` | {{macro}}, {{consumed}} grams. | {{macro}}, {{consumed}} gramas. |
| `diary.macros.a11yOver` | {{macro}}, {{consumed}} of {{target}} grams, over target. | {{macro}}, {{consumed}} de {{target}} gramas, acima do objetivo. |
| `diary.macros.unknownCarbs` | Some entries have unknown carbs. | Algumas entradas têm hidratos desconhecidos. |
| `diary.macros.unknownProtein` | Some entries have unknown protein. | Algumas entradas têm proteína desconhecida. |
| `diary.macros.unknownFat` | Some entries have unknown fat. | Algumas entradas têm gordura desconhecida. |
| `diary.macros.a11yUnknown` | {{macro}}, unknown, target {{target}} grams. | {{macro}}, desconhecido, objetivo {{target}} gramas. |
| `diary.macros.a11yUnknownNoGoal` | {{macro}}, unknown. | {{macro}}, desconhecido. |
| `diary.meal.addFood` | Add food | Adicionar alimento |
| `diary.meal.addFoodTo` | Add food to {{meal}} | Adicionar alimento a {{meal}} |
| `diary.meal.openHint` | Opens meal details | Abre os detalhes da refeição |
| `diary.entry.quickCalories` | Quick Calories | Calorias rápidas |
| `diary.entry.quickA11y` | {{name}}, {{value}} {{unit}}. Macros unknown. | {{name}}, {{value}} {{unit}}. Macronutrientes desconhecidos. |
| `diary.entry.quickNoteA11y` | {{note}}, Quick Calories, {{value}} {{unit}}. Macros unknown. | {{note}}, Calorias rápidas, {{value}} {{unit}}. Macronutrientes desconhecidos. |
| `diary.defaultGoals.message` | Using default goals | A usar objetivos predefinidos |
| `diary.defaultGoals.action` | Set goals | Definir objetivos |
| `diary.loadError.title` | Couldn't load this day. | Não foi possível carregar este dia. |
| `diary.loadError.retry` | Retry | Tentar novamente |
| **profile** | | |
| `profile.title` | Profile | Perfil |
| `profile.current` | Current | Atual |
| `profile.goal` | Goal | Objetivo |
| `profile.noWeight` | No weight logged yet | Ainda sem peso registado |
| `profile.updateWeight` | Update weight | Atualizar peso |
| `profile.weightHistory` | Weight history | Histórico de peso |
| `profile.goalsSection` | Goals | Objetivos |
| `profile.caloriesMacros` | Calories & macros | Calorias e macros |
| `profile.weightGoal` | Weight goal | Objetivo de peso |
| `profile.diarySection` | Diary | Diário |
| `profile.meals` | Meals | Refeições |
| `profile.mealCount_one` | {{count}} meal | {{count}} refeição |
| `profile.mealCount_other` | {{count}} meals | {{count}} refeições |
| `profile.units` | Units | Unidades |
| `profile.foodDataSection` | Food data | Dados de alimentos |
| `profile.foodDatabases` | Food databases | Bases de dados de alimentos |
| `profile.usdaOn` | USDA on | USDA ativo |
| `profile.usdaOff` | USDA off | USDA inativo |
| **caloriesMacros** | | |
| `caloriesMacros.title` | Calories & macros | Calorias e macros |
| `caloriesMacros.calories` | Calories | Calorias |
| `caloriesMacros.carbs` | Carbs | Hidratos |
| `caloriesMacros.protein` | Protein | Proteína |
| `caloriesMacros.fat` | Fat | Gordura |
| `caloriesMacros.helper` | ≈ {{energy}} {{unit}} · {{percent}}% | ≈ {{energy}} {{unit}} · {{percent}} % |
| `caloriesMacros.footnote` | Changes apply from today. Past days keep their goals. | As alterações aplicam-se a partir de hoje. Os dias anteriores mantêm os seus objetivos. |
| `caloriesMacros.save` | Save | Guardar |
| `caloriesMacros.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `caloriesMacros.discardTitle` | Discard changes? | Descartar alterações? |
| `caloriesMacros.discard` | Discard | Descartar |
| `caloriesMacros.keepEditing` | Keep editing | Continuar a editar |
| `caloriesMacros.errors.calories` | Enter calories from {{min}} to {{max}} {{unit}}. | Introduza calorias de {{min}} a {{max}} {{unit}}. |
| `caloriesMacros.errors.macro` | Enter a whole number from 0 to {{max}} g. | Introduza um número inteiro de 0 a {{max}} g. |
| **foodDatabases** | | |
| `foodDatabases.title` | Food Databases | Bases de dados de alimentos |
| `foodDatabases.alwaysOn` | Always on | Sempre ativo |
| `foodDatabases.notSet` | Not set up | Não configurado |
| `foodDatabases.active` | Active | Ativo |
| `foodDatabases.saved` | Saved · will check when online | Guardada · será verificada quando houver ligação |
| `foodDatabases.rejectedStatus` | Key rejected | Chave rejeitada |
| `foodDatabases.key` | USDA API key | Chave da API USDA |
| `foodDatabases.addKey` | Add key | Adicionar chave |
| `foodDatabases.replaceKey` | Replace key | Substituir chave |
| `foodDatabases.saveKey` | Save key | Guardar chave |
| `foodDatabases.testKey` | Test key | Testar chave |
| `foodDatabases.testing` | Testing… | A testar… |
| `foodDatabases.removeKey` | Remove key | Remover chave |
| `foodDatabases.signup` | Get a USDA API key | Obter uma chave da API USDA |
| `foodDatabases.keyError` | Enter a USDA API key without spaces. | Introduza uma chave da API USDA sem espaços. |
| `foodDatabases.demoKey` | Use your own key; DEMO_KEY is limited to 30 requests per hour. | Use a sua chave; DEMO_KEY está limitada a 30 pedidos por hora. |
| `foodDatabases.rejected` | USDA rejected this key. | A USDA rejeitou esta chave. |
| `foodDatabases.keyWorks` | Key works. | A chave funciona. |
| `foodDatabases.keyRateLimited` | Key works, but it's over its hourly limit right now. | A chave funciona, mas está acima do limite horário neste momento. |
| `foodDatabases.savedOffline` | Saved · will check when online | Guardada · será verificada quando houver ligação |
| `foodDatabases.testFailed` | Couldn't reach USDA. Try again. | Não foi possível contactar a USDA. Tente novamente. |
| `foodDatabases.connectToTest` | Connect to the internet to test. | Ligue-se à internet para testar. |
| `foodDatabases.removeTitle` | Remove USDA API key? | Remover a chave da API USDA? |
| `foodDatabases.removeBody` | USDA search will stop. Saved foods stay. | A pesquisa USDA vai parar. Os alimentos guardados permanecem. |
| `foodDatabases.searchResults` | Search results | Resultados da pesquisa |
| `foodDatabases.lastVisible` | At least one section must be shown. | Tem de mostrar pelo menos uma secção. |
| `foodDatabases.sectionsSaveError` | Couldn't save the change. Try again. | Não foi possível guardar a alteração. Tente novamente. |
| **addActions** | | |
| `addActions.sheetLabel` | Add actions | Ações de adicionar |
| `addActions.addFood` | Add food | Adicionar alimento |
| `addActions.quickCalories` | Quick calories | Calorias rápidas |
| `addActions.updateWeight` | Update weight | Atualizar peso |
| **seed** | | |
| `seed.meals.breakfast` | Breakfast | Pequeno-almoço |
| `seed.meals.lunch` | Lunch | Almoço |
| `seed.meals.dinner` | Dinner | Jantar |
| `seed.meals.snacks` | Snacks | Lanches |
| **startup** | | |
| `startup.title` | Couldn't open your diary. | Não foi possível abrir o seu diário. |
| `startup.body` | Your data is still on this device. Try again, or copy the diagnostic info if it keeps happening. | Os seus dados continuam neste dispositivo. Tente novamente ou copie as informações de diagnóstico se o problema persistir. |
| `startup.retry` | Retry | Tentar novamente |
| `startup.copyDiagnostics` | Copy diagnostic info | Copiar informações de diagnóstico |
| `startup.loading` | Opening your diary | A abrir o seu diário |
| **datePicker** | | |
| `datePicker.title` | Choose date | Escolher data |
| `datePicker.done` | Done | Concluído |
| `datePicker.today` | Today | Hoje |
| `datePicker.todayHint` | Shows today's diary | Mostra o diário de hoje |
| **mealPicker** | | |
| `mealPicker.title` | Choose meal | Escolher refeição |
| **quickCalories** | | |
| `quickCalories.title` | Quick calories | Calorias rápidas |
| `quickCalories.editTitle` | Edit quick calories | Editar calorias rápidas |
| `quickCalories.meal` | Meal | Refeição |
| `quickCalories.mealHint` | Opens the meal picker | Abre a escolha de refeição |
| `quickCalories.calories` | Calories | Calorias |
| `quickCalories.note` | Note | Nota |
| `quickCalories.date` | Date | Data |
| `quickCalories.add` | Add | Adicionar |
| `quickCalories.save` | Save | Guardar |
| `quickCalories.delete` | Delete entry | Eliminar registo |
| `quickCalories.caloriesError` | Enter a whole number from {{min}} to {{max}} {{unit}}. | Introduza um número inteiro de {{min}} a {{max}} {{unit}}. |
| `quickCalories.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `quickCalories.deleteError` | Couldn't delete. Try again. | Não foi possível eliminar. Tente novamente. |
| `quickCalories.deleteTitle` | Delete quick calories? | Eliminar calorias rápidas? |
| `quickCalories.deleteBody` | {{energy}} from {{meal}} on {{date}}. | {{energy}} de {{meal}} em {{date}}. |
| **foodSearch** | | |
| `foodSearch.title` | Food search | Pesquisa de alimentos |
| `foodSearch.placeholder` | Search foods | Pesquisar alimentos |
| `foodSearch.searchLabel` | Search foods | Pesquisar alimentos |
| `foodSearch.clear` | Clear search | Limpar pesquisa |
| `foodSearch.context` | Adding to {{meal}} · {{date}} | A adicionar a {{meal}} · {{date}} |
| `foodSearch.quickCalories` | Quick calories | Calorias rápidas |
| `foodSearch.createCustom` | Create custom food | Criar alimento personalizado |
| `foodSearch.recent` | Recent | Recentes |
| `foodSearch.myFoods` | My foods | Os meus alimentos |
| `foodSearch.saved` | Saved | Guardados |
| `foodSearch.usdaFailed` | USDA search failed. | A pesquisa USDA falhou. |
| `foodSearch.usdaBusy` | USDA is busy. Try again later. | A USDA está ocupada. Tente novamente mais tarde. |
| `foodSearch.usdaKeyMissing` | Add a USDA API key to search USDA | Adicione uma chave da API USDA para pesquisar na USDA |
| `foodSearch.usdaKeyRejected` | USDA rejected your key. | A USDA rejeitou a sua chave. |
| `foodSearch.foodDatabases` | Food Databases | Bases de dados de alimentos |
| `foodSearch.offFailed` | Open Food Facts search failed. | A pesquisa no Open Food Facts falhou. |
| `foodSearch.offLoadFailed` | Couldn't load this food. | Não foi possível carregar este alimento. |
| `foodSearch.offline` | Offline. Showing saved foods only. | Sem ligação. A mostrar apenas alimentos guardados. |
| `foodSearch.loadingFood` | Loading food… | A carregar alimento… |
| `foodSearch.offBusy` | Open Food Facts is busy. Try again later. | O Open Food Facts está ocupado. Tente novamente mais tarde. |
| `foodSearch.providerNoResults` | No results from {{provider}}. | Sem resultados no {{provider}}. |
| `foodSearch.retry` | Retry | Tentar novamente |
| `foodSearch.showMore` | Show more | Mostrar mais |
| `foodSearch.emptyRecent` | Search for a food to add it. | Pesquise um alimento para o adicionar. |
| `foodSearch.searching` | Searching… | A pesquisar… |
| `foodSearch.noResults` | No foods found for “{{query}}”. | Nenhum alimento encontrado para «{{query}}». |
| `foodSearch.perBasis` | per {{quantity}} {{unit}} | por {{quantity}} {{unit}} |
| `foodSearch.sources.custom` | Custom | Personalizado |
| `foodSearch.delete` | Delete | Eliminar |
| `foodSearch.deleteFood` | Delete food | Eliminar alimento |
| `foodSearch.deleteError` | Couldn't delete this food. Try again. | Não foi possível eliminar este alimento. Tente novamente. |
| **customFood** | | |
| `customFood.title` | New food | Novo alimento |
| `customFood.name` | Name* | Nome* |
| `customFood.brand` | Brand | Marca |
| `customFood.serving` | Serving* | Porção* |
| `customFood.otherUnit` | Serving unit | Unidade da porção |
| `customFood.nutrition` | Nutrition | Nutrição |
| `customFood.nutritionPer` | Nutrition per {{amount}} {{unit}} | Nutrição por {{amount}} {{unit}} |
| `customFood.calories` | Calories* | Calorias* |
| `customFood.protein` | Protein* | Proteína* |
| `customFood.carbohydrate` | Carbs* | Hidratos* |
| `customFood.fat` | Fat* | Gordura* |
| `customFood.carbsHelper` | As on EU labels (fibre not included) | Como nos rótulos da UE (fibra não incluída) |
| `customFood.save` | Save | Guardar |
| `customFood.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `customFood.discardTitle` | Discard changes? | Descartar alterações? |
| `customFood.discard` | Discard | Descartar |
| `customFood.keepEditing` | Keep editing | Continuar a editar |
| `customFood.units.other` | Other… | Outro… |
| `customFood.errors.name` | Enter a name up to 80 characters. | Introduza um nome até 80 caracteres. |
| `customFood.errors.amount` | Enter an amount greater than 0 and no more than {{max}}. | Introduza uma quantidade superior a 0 e até {{max}}. |
| `customFood.errors.otherUnit` | Enter a serving unit. | Introduza uma unidade de porção. |
| `customFood.errors.energy` | Enter calories from 1 to {{max}} {{unit}}. | Introduza calorias de 1 a {{max}} {{unit}}. |
| `customFood.errors.macro` | Enter an amount from 0 to {{max}} g. | Introduza uma quantidade de 0 a {{max}} g. |
| **servingRuler** | | |
| `servingRuler.a11y` | Serving, {{quantity}}, {{serving}}, {{energy}} {{unit}} | Porção, {{quantity}}, {{serving}}, {{energy}} {{unit}} |
| `servingRuler.editValue` | Enter serving value, current value {{value}} | Introduzir valor da porção, valor atual {{value}} |
| **foodDetail** | | |
| `foodDetail.title` | Add food | Adicionar alimento |
| `foodDetail.editTitle` | Edit entry | Editar registo |
| `foodDetail.moreUnits` | More… | Mais… |
| `foodDetail.carbs` | Carbs | Hidratos |
| `foodDetail.protein` | Protein | Proteína |
| `foodDetail.fat` | Fat | Gordura |
| `foodDetail.meal` | Meal | Refeição |
| `foodDetail.date` | Date | Data |
| `foodDetail.addTo` | Add to {{meal}} | Adicionar a {{meal}} |
| `foodDetail.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `foodDetail.chooseUnit` | Choose serving unit | Escolher unidade da porção |
| `foodDetail.enterServing` | Enter serving value | Introduzir valor da porção |
| `foodDetail.serving` | Serving | Porção |
| `foodDetail.done` | Done | Concluir |
| `foodDetail.save` | Save | Guardar |
| `foodDetail.delete` | Delete entry | Eliminar registo |
| `foodDetail.deleteTitle` | Delete food entry? | Eliminar registo de alimento? |
| `foodDetail.deleteBody` | {{name}}, {{quantity}} {{unit}}, from {{meal}} on {{date}}. | {{name}}, {{quantity}} {{unit}}, de {{meal}} em {{date}}. |
| `foodDetail.deleteError` | Couldn't delete. Try again. | Não foi possível eliminar. Tente novamente. |
| **mealDetail** | | |
| `mealDetail.copyMeal` | Copy meal | Copiar refeição |
| `mealDetail.empty` | No foods logged for this meal. | Nenhum alimento registado nesta refeição. |
| `mealDetail.addFood` | Add food | Adicionar alimento |
| **copyMeal** | | |
| `copyMeal.title` | Copy {{meal}} to | Copiar {{meal}} para |
| `copyMeal.today` | Today · {{date}} | Hoje · {{date}} |
| `copyMeal.tomorrow` | Tomorrow · {{date}} | Amanhã · {{date}} |
| `copyMeal.chooseDate` | Choose date… | Escolher data… |
| `copyMeal.dateTitle` | Copy to date | Copiar para a data |
| `copyMeal.copied_one` | Copied {{count}} item to {{meal}}, {{date}} | {{count}} item copiado para {{meal}}, {{date}} |
| `copyMeal.copied_other` | Copied {{count}} items to {{meal}}, {{date}} | {{count}} itens copiados para {{meal}}, {{date}} |
| `copyMeal.error` | Couldn't copy. Try again. | Não foi possível copiar. Tente novamente. |
| **units** | | |
| `units.title` | Units | Unidades |
| `units.weight` | Body weight | Peso corporal |
| `units.foodWeight` | Food weight | Peso dos alimentos |
| `units.energy` | Energy | Energia |
| `units.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| **meals** | | |
| `meals.title` | Meals | Refeições |
| `meals.addMeal` | Add meal | Adicionar refeição |
| `meals.moveUp` | Move up | Mover para cima |
| `meals.moveDown` | Move down | Mover para baixo |
| `meals.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| **mealEdit** | | |
| `mealEdit.addTitle` | Add meal | Adicionar refeição |
| `mealEdit.editTitle` | Edit meal | Editar refeição |
| `mealEdit.name` | Name | Nome |
| `mealEdit.save` | Save | Guardar |
| `mealEdit.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `mealEdit.nameError` | Enter a name up to 40 characters. | Introduza um nome com até 40 caracteres. |
| `mealEdit.duplicate` | You already have a meal named {{name}}. | Já tem uma refeição chamada {{name}}. |
| `mealEdit.delete` | Delete meal | Eliminar refeição |
| `mealEdit.lastMeal` | At least one meal is required. | É necessária pelo menos uma refeição. |
| `mealEdit.deleteTitle` | Delete {{name}}? | Eliminar {{name}}? |
| `mealEdit.deleteConfirm` | Delete meal | Eliminar refeição |
| `mealEdit.moveTitle_one` | Delete {{name}}? It has {{count}} entry. Move it to: | Eliminar {{name}}? Tem {{count}} registo. Mover para: |
| `mealEdit.moveTitle_other` | Delete {{name}}? It has {{count}} entries. Move them to: | Eliminar {{name}}? Tem {{count}} registos. Movê-los para: |
| `mealEdit.moveConfirm` | Delete and move entries | Eliminar e mover registos |
| `mealEdit.deleteError` | Couldn't delete. Try again. | Não foi possível eliminar. Tente novamente. |
| **weightGoal** | | |
| `weightGoal.title` | Weight goal | Objetivo de peso |
| `weightGoal.field` | Goal weight | Peso objetivo |
| `weightGoal.clear` | Clear goal | Limpar objetivo |
| `weightGoal.save` | Save | Guardar |
| `weightGoal.error` | Enter a weight from {{min}} to {{max}} {{unit}}. | Introduza um peso entre {{min}} e {{max}} {{unit}}. |
| `weightGoal.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| **weightEntry** | | |
| `weightEntry.createTitle` | Update weight | Atualizar peso |
| `weightEntry.editTitle` | Edit weight | Editar peso |
| `weightEntry.date` | Date | Data |
| `weightEntry.today` | Today, {{date}} | Hoje, {{date}} |
| `weightEntry.yesterday` | Yesterday, {{date}} | Ontem, {{date}} |
| `weightEntry.field` | Weight | Peso |
| `weightEntry.save` | Save | Guardar |
| `weightEntry.error` | Enter a weight from {{min}} to {{max}} {{unit}}. | Introduza um peso entre {{min}} e {{max}} {{unit}}. |
| `weightEntry.saveError` | Couldn't save. Try again. | Não foi possível guardar. Tente novamente. |
| `weightEntry.delete` | Delete weight | Eliminar peso |
| `weightEntry.deleteTitle` | Delete weight entry? | Eliminar registo de peso? |
| `weightEntry.deleteBody` | {{weight}} on {{date}}. | {{weight}} em {{date}}. |
| `weightEntry.deleteConfirm` | Delete weight | Eliminar peso |
| `weightEntry.deleteError` | Couldn't delete. Try again. | Não foi possível eliminar. Tente novamente. |
| **weightHistory** | | |
| `weightHistory.title` | Weight history | Histórico de peso |
| `weightHistory.add` | Update weight | Atualizar peso |
| `weightHistory.empty` | No weight entries yet. | Ainda não há registos de peso. |
