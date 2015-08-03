var ʔ = (function ($) {
    //CONSTANTS - Start
    var queryControlIdPrefix = "queryControlDiv"; //Prefix for the query row control div id
    var tableQueryBuilder = "tableQueryBuilder";
    //Classes - Start
    var primarySelectClass = "JQQueryBuilderPrimarySelect"; //Class for the first query row select item
    var userInputClass = "JQQueryBuilderUserInput"; //Class for user input item for the query row
    var operationSelectClass = "JQQueryBuilderOperationSelect"; //Class for the operation select in the query row
    var removeRowClass = "JQQueryRowRemove"; //Class for the 'remove' button for the query row
    var addRowClass = "JQQueryRowAdd"; //Class for the 'add' button for the query row
    var queryControlRow = "JQQueryControlRow"; //Class for the div that holds the table in which the query row controls sit
    var queryOperationCell = "JQQueryOperationCell"; //Class for the table cell that holds the operation select control
    var queryInputCell = "JQQueryInputCell"; //Class for the table cell that holds the user input control
    var userInputDropdownStyleClass = "userInputDropdownStyle";
    var primarySelectDropdownStyleClass = "primarySelectDropdownStyle";
    var operationSelectDropdownStyleClass = "operationSelectDropdownStyle";
    var userInputTextboxStyleClass = "userInputTextboxStyle";
    var datePickerClass = "datepicker";
    var typeAheadClass = "typeahead";
    var dataPrimarySelectOption = 'primaryselectoption';
    var toggleSwitchClasses = 'Switch';
    //Classes - End
    //CONSTANTS - End

    //PRIVATE MEMBERS - Start
    var queryDataStore; //Holds the option objects (QueryBuilderDataItem) available for the query control row
    var queryReferenceData; //Contains the key/value(object) dictionary for dropdown user input types (i.e. State)
    var queryControlElement; //Contains the DOM element where the query control will rest in the calling view
    var queryControlElementTable; //Contains the DOM element where the query control will rest in the calling view
    var nextQueryControlId = 1; //Maintains the next id to be appended to the queryControlIdPrefix when building a query control row
    var totalQueryControlCount = 0; //Maintains the total query control rows - used for showing/hiding the remove button
    
    var context = { clearResults: $.noop };
    //PRIVATE MEMBERS - End

    //PUBLIC Methods - Start
    function initialize(modelData, referenceData, queryControlElementId, includeTypeAheadSearch, options) {
        context = $.extend(context, options);
        //Function for setting up the query builder the first time and building the first query control row
        queryDataStore = modelData;

        var initialUserInput = buildAnswerTemplateDropDown(modelData);
        queryReferenceData = referenceData;
        queryControlElement = $('#' + queryControlElementId);
        queryControlElementTable = null;
        if (includeTypeAheadSearch) {
        }

        buildQueryControlRows(initialUserInput);

        $(queryControlElement).on('click', '.' + removeRowClass, function () { QueryBuilder.RemoveQueryRow(this); });
        $(queryControlElement).on('click', '.' + addRowClass, function () { QueryBuilder.AddQueryRow(this); });
        $(queryControlElement).on('change', '.' + primarySelectClass, function () { QueryBuilder.PrimarySelectChanged(this); });

        setTootlTip();
    }
    function reinitialize(modelData) {
        //Function for resetting the primary select options for building a query control row
        queryDataStore = modelData;
        resetQueryBuilder();
        var initialUserInput = buildAnswerTemplateDropDown(modelData);
        buildQueryControlRows(initialUserInput);
    }

    function resetQueryBuilder() {
        $(queryControlElement).html("");
        queryControlElementTable = null;
        totalQueryControlCount = 0;
        nextQueryControlId = 1;
    }

    function buildAnswerTemplateDropDown(modelData) {
        var initialInputs = null;
        var queryBuilderAnswerTemplate = $('#queryBuilderAnswerTemplateBox');
        queryBuilderAnswerTemplate.empty();
        queryBuilderAnswerTemplate.hide();
        if (modelData.Answers !== null) {
            if (modelData.Answers.length > 1) {
                queryBuilderAnswerTemplate.show();
            }
            var templateAnswerOptions = [];
            $.each(modelData.Answers, function (index, item) {
                var selected = false;
                if (item.Code === modelData.SelectedAnswerTemplate) {
                    initialInputs = item.InitialAnswers;
                    selected = true;
                }
                templateAnswerOptions.push($('<option>', {
                    text: item.DisplayText,
                    value: item.Code,
                    selected: selected
                }));
            });
            queryBuilderAnswerTemplate.append(templateAnswerOptions);
        }
        queryBuilderAnswerTemplate.change(function () {
            var selectedTemplate = $(this).val();
            var template = $.grep(queryDataStore.Answers, function(answerTemplate) {
                return answerTemplate.Code === selectedTemplate;
            });
            context.clearResults();
            resetQueryBuilder();
            buildQueryControlRows(template[0].InitialAnswers);
        });
        return initialInputs;
    }

    function removeQueryRow(minusClicked) {
        $(minusClicked).parents('.' + queryControlRow).remove();
        updateQueryControlCount("remove");
    }
    function addQueryRow(plusClicked) {
        buildQueryRow(getDefaultQueryItem());
        //the updateQueryControlCount is handled in the buildQueryRow() function
        $(queryControlElement).scrollParent().animate({ scrollTop: $(queryControlElement).scrollParent()[0].scrollHeight }, 1000);
    }
    function primarySelectChanged(selectThatChanged) {

        //Check first whether or not there is already a PrimarySelect with 
        //the new value and using the Equals operator
        var $selectThatChanged = $(selectThatChanged);
        if (doesSamePrimarySelectOptionExistWithEqualsOperator($selectThatChanged)) {
            return;
        }

        //Fires when the user changes the first select item in a query row
        //We need to check the value and change the operation select and the user input cell
        var selectedValue = $selectThatChanged.val();
        var controlRow = $selectThatChanged.parents('.' + queryControlRow);

        $selectThatChanged.data(dataPrimarySelectOption, selectedValue);

        var operationCell = $(controlRow).find('.' + queryOperationCell);
        var inputCell = $(controlRow).find('.' + queryInputCell);

        //Once we know the available operations and input info, rebuild the two cells
        $(operationCell).html(buildSelectWithOptions(getOperationsOptionListByEnumValues(getQueryDataItemByKey(selectedValue).Operations),
            getQueryDataItemByKey(selectedValue).DefaultOperation,
            getClassStringFromClassArray([operationSelectClass, operationSelectDropdownStyleClass]), "Display", "Value"));
        $(inputCell).html(buildUserInputControl(selectedValue));

        applySpecialControlModificationsToLastUserInput(inputCell);
    }
    function getUserQueries() {
        //Function for getting the data from the query builder to send back to the server for processing
        var queries = [];
        $('.' + queryControlRow).each(function () {
            var filterByElement = $(this).find('.' + primarySelectClass);
            var selectValue = filterByElement.val();
            if (selectValue === '') {
                return false;
            }
            var operationValue = $(this).find('.' + operationSelectClass).val();
            var inputCtrl = $(this).find('.' + userInputClass);
            var inputValue = inputCtrl.val();
            var excelExportValue = inputCtrl.is('select') ? inputCtrl.find('option:selected').text() : inputValue;
            if (inputCtrl.is('[data-value]')) {
                // This is for Type Ahead
                inputValue = inputCtrl.attr('data-value');
                excelExportValue = inputCtrl.attr('data-text');
            }
            if (inputCtrl.hasClass(toggleSwitchClasses)) {
                inputValue = inputCtrl.hasClass('On');
                excelExportValue = inputValue;
            }
            queries.push({
                Name: selectValue,
                Operation: operationValue,
                Value: inputValue,
                ExcelExportCriteria: { Name: filterByElement.find('option:selected').text(), Value: escape(excelExportValue) }
            });
        });

        return queries;
    }

    //PUBLIC Methods - End

    //PRIVATE Methods - Start
    var buildQueryRow = function (selectOption) {
        //Builds a basic query row using default options/values

        var isMandatoryClass = getMandatoryClass(queryDataStore.Options, selectOption);
        var primarySelect = buildSelectWithOptions(queryDataStore.Options, selectOption,
            getClassStringFromClassArray([primarySelectClass, primarySelectDropdownStyleClass]),
            "Display", "Name", isMandatoryClass.length > 0);
        var operationSelect = buildSelectWithOptions(getOperationsOptionListByEnumValues(getQueryDataItemByKey(selectOption).Operations),
            getQueryDataItemByKey(selectOption).DefaultOperation,
            getClassStringFromClassArray([operationSelectClass, operationSelectDropdownStyleClass]), "Display", "Value");
        var userInputControl = buildUserInputControl(selectOption, null);

        buildQueryRowHtml(primarySelect, operationSelect, userInputControl, isMandatoryClass);
    };

    var buildInitialUserInputQueryRow = function (userInput) {
        //Builds a query row based off of provided options and values
        var selectOption = userInput.Name;
        var selectedOperation = userInput.Operation;
        var inputValue = userInput.Value;
        var isMandatoryClass = getMandatoryClass(queryDataStore.Options, selectOption);
        var primarySelect = buildSelectWithOptions(queryDataStore.Options, selectOption,
            getClassStringFromClassArray([primarySelectClass, primarySelectDropdownStyleClass]),
            "Display", "Name", isMandatoryClass.length > 0);
        var operationSelect =
            buildSelectWithOptions(getOperationsOptionListByEnumValues(getQueryDataItemByKey(selectOption).Operations), selectedOperation,
            getClassStringFromClassArray([operationSelectClass, operationSelectDropdownStyleClass]), "Display", "Value");
        var userInputControl = buildUserInputControl(selectOption, inputValue);

        buildQueryRowHtml(primarySelect, operationSelect, userInputControl, isMandatoryClass);
    };
    var getMandatoryClass = function(optionsList, selectedOptionValue) {
        var mandatoryClass = '';
        for (var i = 0; i < optionsList.length; i++) {
            var selectValue = optionsList[i].Name;
            if (selectedOptionValue === selectValue) {
                mandatoryClass = (optionsList[i].IsMandatory) ? 'isMandatory' : '';
                return mandatoryClass;
            }
        }
        return mandatoryClass;
    };
    var buildSelectWithOptions = function (optionsList, selectedOptionValue, selectClass, optionTextProperty, optionValueProperty, isLocked) {
        var options = '';
        var disabled = optionsList.length <= 1 || isLocked ? ' disabled="disabled"' : '';
        for (var i = 0; i < optionsList.length; i++) {
            //If null is passed in, then it is just a string value, not an object, so use the value at [i]
            var displayValue = optionTextProperty === null ? optionsList[i] : optionsList[i][optionTextProperty];
            var selectValue = optionValueProperty === null ? optionsList[i] : optionsList[i][optionValueProperty];

            var selected = '';
            if (selectedOptionValue === selectValue) {
                selected = 'selected="selected"';
            }

            options += '<option value="' + selectValue + '" ' + selected + '>' + displayValue + '</option>';
        }
        return '<select' + disabled + ' class="' + selectClass + '" data-primaryselectoption="' + selectedOptionValue + '">' + options + '</select>';
    };
    var getDefaultQueryItem = function () {
        return queryDataStore.DefaultOptionName;
    };
    var getQueryDataItemByKey = function (key) {
        var queryItemToReturn;
        for (var i = 0; i < queryDataStore.Options.length; i++) {
            if (queryDataStore.Options[i].Name.toLowerCase() === key.toLowerCase()) {
                queryItemToReturn = queryDataStore.Options[i];
            }
        }

        return queryItemToReturn;
    };
    var buildContactSearchTypeAhead = function (searchType, inputValue) {
        if (searchType === undefined || searchType === null) {
            return '';
        }
        var labelContainer, labelContent, textboxContent;
        var image = $('<span />', { 'class': 'searchIcon mLeft5 inlineBlock' });
        var container = $('<div />', { 'class': typeAheadClass, 'data-searchtype': searchType });
        switch (searchType) {            
            default:
                return '';
        }
        labelContent.appendTo(labelContainer);
        image.appendTo(labelContainer);
        labelContainer.appendTo(container);
        textboxContent.appendTo(container);
        return container.prop('outerHTML');
    };
    var buildUserInputControl = function (selectValue, inputValue) {
        var queryDataItem = getQueryDataItemByKey(selectValue);
        var control = '';
        var classes = '';
        var currentInputValue = inputValue === null || inputValue === undefined ? "" : inputValue;
        switch (queryDataItem.QueryBuilderControl.Type) {
            case "textbox":
                var d = new Date();
                var t = d.getTime();

                var uniqueName = queryDataItem.Name + '_' + t;
                var mask = queryDataItem.QueryBuilderControl.Mask;
                mask = mask.length === 0 ? '' : ' data-mask="' + mask + '"';
                classes = getClassStringFromClassArray([userInputClass, userInputTextboxStyleClass, "JQIgnoreDirty"]);
                control =
                    '<input type="textbox" class="' + classes + '" name="' + uniqueName + '" ' + 
                        mask + ' value="' + currentInputValue.htmlEscape() + '"/>';
                break;
            case "dropdown":
                classes = getClassStringFromClassArray([userInputClass, userInputDropdownStyleClass]);
                control = buildSelectWithOptions(queryReferenceData[queryDataItem.ReferenceLookupName],
                currentInputValue, classes, "Display", "Value");
                break;
            case "date":
                classes = getClassStringFromClassArray([userInputClass, datePickerClass]);
                control = '<input type="textbox" readonly="readonly" class="' + classes + '"' +
                    ' value="' + currentInputValue + '"/>';
                break;
            case "typeahead":
                //control = buildTypeAhead(queryDataItem.QueryBuilderControl.TypeAheadSearchType, inputValue);
                break;
            case "label":
                control = '<label>Select filter by option.</label>';
                break;
            case "toggleswitch":
                classes = getClassStringFromClassArray([userInputClass, toggleSwitchClasses, 'On']);
                control = '<div class="' + classes + '"><div class="Toggle"></div><span class="On">Yes</span><span class="Off">No</span></div>';
                break;
        }
        return control;
    };
    var updateQueryControlCount = function (action) {
        switch (action) {
            case "remove":
                totalQueryControlCount--;
                break;
            case "add":
                nextQueryControlId++;
                totalQueryControlCount++;
                break;
        }

        if (totalQueryControlCount <= 1) {
            $('.' + removeRowClass).hide();
        } else {
            $('.' + removeRowClass).show();
        }
    };
    var buildQueryRowHtml = function (primarySelect, operationSelect, userInput, isMandatoryClass) {
        //Build the actual HTML for the query row based on the provided select and inputs
        var controlCells =
            '<td>' + primarySelect + '</td>' +
            '<td class="' + queryOperationCell + '">' + operationSelect + '</td>' +
            '<td class="' + queryInputCell + '">' + userInput + '</td>' +
            '<td class="' + isMandatoryClass + '" ><div class="removeQueryRow ' + removeRowClass + '"/></td>' +
            '<td><div class="addQueryRow ' + addRowClass + '"/></td>';

        if (queryControlElementTable === null) {
            var queryBuilderTable = '<table id="' + tableQueryBuilder + '" class="queryBuilderTable"></table>';
            $(queryControlElement).append(queryBuilderTable);
            queryControlElement = $('#' + tableQueryBuilder);
        }

        $(queryControlElement).append('<tr class="' + queryControlRow + '" id="' +
            queryControlIdPrefix + nextQueryControlId + '">' + controlCells + '</tr>');

        applySpecialControlModificationsToLastUserInput($('#' + queryControlIdPrefix + nextQueryControlId).find('.' + queryInputCell));

        updateQueryControlCount("add"); //Do this here since buildQueryRow() can be called from various places
    };
    var getOperationsOptionListByEnumValues = function (operations) {
        var operationsArray = [];
        var operationsEnum = top.EAEnums.QueryBuilderOperations;
        for (var i = 0; i < operations.length; i++) {
            for (var prop in operationsEnum) {
                if (operations[i] === operationsEnum[prop].Value) {
                    operationsArray.push(operationsEnum[prop]);
                    break;
                }
            }
        }

        return operationsArray;
    };
    var applySpecialControlModificationsToLastUserInput = function (inputCell) {
        var setCaratToEnd = true;
        var ctrl = $(inputCell).children().first();
        var maskValue = ctrl.data("mask");
        if (maskValue !== null && maskValue !== undefined && maskValue.length > 0) {
            ctrl.mask(maskValue);
            setCaratToEnd = false; //Masked controls should have carat at the beginning
        }
        if (ctrl.hasClass(datePickerClass)) {
            setCaratToEnd = false;
            var ctrlValue = ctrl.val();
            ctrlValue = ctrlValue === "" ? new Date() : new Date(ctrlValue);
            ctrl.datepicker({
                showOn: "button",
                buttonImage: "../Images/appt.png",
                buttonImageOnly: true,
                buttonText: 'Open Calendar',
                changeMonth: true,
                dateFormat: 'D mm/dd/y',
                changeYear: true
            });
            ctrl.datepicker('setDate', ctrlValue);
        }

        if (ctrl.hasClass(typeAheadClass)) {
            setCaratToEnd = false;
        }
        if (ctrl.hasClass(toggleSwitchClasses)) {
            setCaratToEnd = false;
            $('.Switch').click(function () {
                $(this).toggleClass('On').toggleClass('Off');
            });
        }
        //set focus to control and then set the textbox caret to the end (need timeout otherwise it happens to fast and doesn't work)
        //TODO: need to handle for ie9
        ctrl.focus();

        if (setCaratToEnd) {
            //This will copy the value back into the input, forcing the carat to the end of the input value
            setTimeout(function () { ctrl.val(ctrl.val()); }, 75);
        }
    };
    var getClassStringFromClassArray = function (classArray) {
        var classString = '';
        for (var i = 0; i < classArray.length; i++) {
            classString += classArray[i];
            if (i < classArray.length - 1) {
                classString += ' ';
            }
        }
        return classString;
    };
        var defaultValue = { id: '', name: '', type: '', agencyid: 0 };

        if (inputValue !== undefined && inputValue !== null) {
            defaultValue = $.parseJSON(inputValue);
        }
        switch (searchType) {
            case 'LOC':
            case 'ENTLOC':
                locationContactViewModel.locationId(defaultValue.id);
                locationContactViewModel.locationName(defaultValue.name);
                locationContactViewModel.locationType(defaultValue.type);
                locationContactViewModel.agencyId(defaultValue.agencyid || 0);
                break;
            case 'CNTC':
                locationContactViewModel.contactId(defaultValue.id);
                locationContactViewModel.contactName(defaultValue.name);
                break;
            case 'USR':
                locationContactViewModel.travelersPersonId(defaultValue.id);
                locationContactViewModel.travelersPersonName(defaultValue.name);
                break;
        }

    };

    var doesSamePrimarySelectOptionExistWithEqualsOperator = function ($primarySelectThatChanged) {
        var primarySelectedOption = $primarySelectThatChanged.data(dataPrimarySelectOption);
        var queryControlRows = $('.' + queryControlRow);
        var foundSamePrimarySelectOptionWithEquals = false;
        $.each(queryControlRows, function (idx, val) {
            var rowPrimarySelectedOption = $(val).find('.' + primarySelectClass).data(dataPrimarySelectOption);
            //skip row where change is requested
            if (primarySelectedOption === rowPrimarySelectedOption) {
                return true;
            }
            var rowOperationSelected = $(val).find('.' + operationSelectClass).text();
            if (rowOperationSelected === 'Equals' && $primarySelectThatChanged.val() === $(val).find('.' + primarySelectClass).val()) {
                alert('You are attempting to select a filter by option that already exists.');
                $primarySelectThatChanged.val(primarySelectedOption);
                foundSamePrimarySelectOptionWithEquals = true;
                //exit loop when same primary select option is found
                return false;
            }
        });

        return foundSamePrimarySelectOptionWithEquals;
    };

    var buildQueryControlRows = function (initialUserInput) {
        if (initialUserInput === null || initialUserInput === undefined || initialUserInput.length <= 0) {
            //No initial user input was provided, so just build the default row by the search type
            for (var j = 0; j < queryDataStore.Options.length; j++) {
                if (queryDataStore.Options[j].ShowOnInitialLoad) {
                    buildQueryRow(queryDataStore.Options[j].Name);
                }
            }
            
        } else {
            for (var i = 0; i < initialUserInput.length; i++) {
                buildInitialUserInputQueryRow(initialUserInput[i]);
            }
        }
    };

    var setTootlTip = function () {
        $('#searchTooltip').tooltip({
            items: "a",
            content: function () {
                if ($(this).is("a")) {
                    var text = $(this).attr("title");
                    return text + '<span class="closeX" style="position:absolute;top:0;right:2px;">&times;</span>';
                }
                return '';
            },
            position: { of: '#tableQueryBuilder', my: 'right top', at: 'right top-40' }
        });

        $(".tooltipClose").click(function () {
            $("#searchTooltip").tooltip("close");
        });

        $('#advancedSearchInfo').click(function () {
            $('#searchTooltip').tooltip('open');
        });

        $(document).mouseup(function (e) {
            if (!$(e.target).hasClass("ui-tooltip-content")) {
                $('#searchTooltip').tooltip('close');
            }
        });
    };
    //PRIVATE Methods - End

    return {
        Init: initialize,
        ReInit: reinitialize,
        RemoveQueryRow: removeQueryRow,
        AddQueryRow: addQueryRow,
        PrimarySelectChanged: primarySelectChanged,
        GetUserQueries: getUserQueries
    };
}(jQuery));
