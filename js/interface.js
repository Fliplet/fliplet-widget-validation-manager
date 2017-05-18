var widgetInstanceId = $('[data-widget-id]').data('widget-id');
var data = Fliplet.Widget.getData(widgetInstanceId) || {};

var $dataSource = $("#dataSource");
var defaultEmailTemplate = $('#email-template-default').html();
var defaultSmsTemplate = 'Your code: {{ code }}';
var dataSources;
var dataSource;

var onTinyMceReady = new Promise(function(resolve) {
  document.addEventListener('tinymce.init', function() {
    resolve();
  })
});

// TinyMCE INIT
tinymce.init({
  selector: '#email-template',
  theme: 'modern',
  plugins: [
    'advlist lists link image charmap hr',
    'searchreplace insertdatetime table textcolor colorpicker code'
  ],
  toolbar: 'formatselect | fontselect fontsizeselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | link | bullist numlist outdent indent | blockquote subscript superscript | table charmap hr | removeformat | code',
  menubar: false,
  statusbar: true,
  inline: false,
  resize: true,
  min_height: 300,
  setup: function (editor) {
    editor.on('init', function (e) {
      var customEvent = new CustomEvent(
        'tinymce.init',
        {
          bubbles: true,
          cancelable: true
        }
      );
      document.dispatchEvent(customEvent);
    });
  }
});  

Fliplet.Widget.onSaveRequest(function() {
  if (!dataSource) {
    return Fliplet.Widget.save({})
      .then(function() {
        return Fliplet.Widget.complete();
      });
  }

  var validation = {
    sms: {
      text: $('#sms-template').val(),
      expire: $('#sms-expire').val(),
      toColumn: $('#sms-to').val(),
      matchColumn: $('#sms-match').val()
    },
    email: {
      text: tinymce.get('email-template').getContent(),
      expire: $('#email-expire').val(),
      toColumn: $('#email-to').val(),
      matchColumn: $('#email-match').val()
    }
  }
  
  // Update data source definitions 
  var options = {
    id: dataSource.id,
    definition: { validation: validation }
  };
  Fliplet.DataSources.update(options)
    .then(function() {
      data = {
        dataSourceId: dataSource.id,
        sms : { matchColumn: $('#sms-match').val() },
        email: { matchColumn: $('#email-match').val() },
      } 

      // Save data source id on the widget instance
      Fliplet.Widget.save(data).then(function() {
        Fliplet.Widget.complete();
      });
    })
});

Fliplet.DataSources.get({ type: null })
  .then(function (sources) {
    dataSources = sources;
    sources.forEach(function (source) {
      $dataSource.append('<option value="' + source.id + '">' + source.name + '</option>');
    });

    // Select data source if there was one selected already
    if (data.dataSourceId) {
      $dataSource.val(data.dataSourceId);
      $dataSource.change();
    }
  });

/**
 * Set current data source and fill in fields 
 */
function selectDataSource(id) {
  var filteredDataSource = dataSources.filter(function (dataSource) {
    return dataSource.id === Number(id);
  });

  if (!filteredDataSource.length) {
    return;
  }

  dataSource = filteredDataSource[0];
  
  var sms = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.sms || {};
  $('#sms-template').val(sms.text || defaultSmsTemplate);
  $('#sms-expire').val(sms.expire || '');
  $('#sms-to').val(sms.toColumn || '');
  $('#sms-match').val(sms.matchColumn || '');

  var email = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.email || {};
  onTinyMceReady.then(function() {
    tinymce.get('email-template').setContent(email.text || defaultEmailTemplate);
  });
  
  $('#email-expire').val(email.expire || '');
  $('#email-to').val(email.toColumn || '');
  $('#email-match').val(email.matchColumn || '');
  
  // And show the types
  $('#accordion').show()
  Fliplet.Widget.autosize();
}

$dataSource.on('change', function() {
  if (!this.value) {
    dataSource = null;
    return $('#accordion').hide();
  }

  selectDataSource(this.value);
});