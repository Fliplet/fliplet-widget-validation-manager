var widgetInstanceId = $('[data-widget-id]').data('widget-id');
var data = Fliplet.Widget.getData(widgetInstanceId) || {};

var $dataSource = $("#dataSource");
var $expireTimeoutSettings = $('.expire-timeout-settings');
var $emailSettings = $('.email-settings');
var $smsSettings = $('.sms-settings');

var defaultEmailTemplate = $('#email-template-default').html();
var defaultEmailSettings = {
  subject: 'Validate your email address',
  html: defaultEmailTemplate,
  to: []
};

var defaultSmsTemplate = 'Your code: {{ code }} (it will expire in {{ expire }} minutes)';
var defaultExpireTimeout = 60;
var dataSources;
var dataSource;

var emailProvider;
var emailProviderResult;

Fliplet.Widget.onSaveRequest(function() {
  if (!dataSource) {
    return Fliplet.Widget.save({});
  }

  if (emailProvider) {
    return emailProvider.forwardSaveRequest();
  }

  return dsQueryProvider.forwardSaveRequest();
});

/**
 * Set current data source and fill in fields
 */
function selectDataSource(ds) {
  dataSource = ds;

  var sms = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.sms || {};
  var email = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.email || {};
  // SMS and email validations use the same expiration values
  // Therefore the value only needs to be restored from the SMS configuration
  $('#expire-timeout').val(sms.expire || defaultExpireTimeout);
  $('#sms-template').val(sms.template || defaultSmsTemplate);

  if (email.domain) {
    $('#email-domain').prop('checked', true).trigger('change');
    $('#email-domains').val(email.domains.join(', '));
  }

  Fliplet.Widget.autosize();
}

var dsQueryData = {};
switch (data.type) {
  case 'sms':
    dsQueryData = {
      settings: {
        dataSourceLabel: 'Select the data source containing the user information',
        filters: false,
        columns: [{
            key: 'smsMatch',
            label: 'Select the column with the email address',
            type: 'single'
          },
          {
            key: 'smsTo',
            label: 'Select the column with the phone number (where the SMS will be sent to)',
            type: 'single'
          }
        ]
      },
      result: data.dataSourceQuery
    };
    break;

  case 'email':
    dsQueryData = {
      settings: {
        dataSourceLabel: 'Select the data source containing the user information',
        filters: false,
        columns: [{
          key: 'emailMatch',
          label: 'Select the column with the email address',
          type: 'single'
        }]
      },
      result: data.dataSourceQuery
    };
    break;

  default:
    break;
}

// Open data source query provider inline
var dsQueryProvider = Fliplet.Widget.open('com.fliplet.data-source-query', {
  selector: '.data-source-query-provider',
  data: dsQueryData,
  onEvent: function(event, data) {
    if (event === 'data-source-changed') {
      selectDataSource(data);

      return true; // Stop propagation up to studio or parent components
    }
  }
});

dsQueryProvider.then(function onForwardDsQueryProvider(result) {
  // If there is no data source just save it althoug not valid config
  if (!dataSource) {
    Fliplet.Widget.save();
  }

  var validation = dataSource.definition.validation || {};

  // Let's update only the selected verification type on the datasurce settings
  switch (data.type) {
    case 'sms':
      validation.sms = {
        toColumn: result.data.columns.smsTo,
        matchColumn: result.data.columns.smsMatch,
        template: $('#sms-template').val(),
        expire: $('#expire-timeout').val(),
      };
      break;

    case 'email':
      // Domains should be comma separated
      var domains = [];
      var domain = $('#email-domain').is(":checked");
      var domainsString = $('#email-domains').val().trim();

      if (domainsString) {
        var domains = domainsString.split(',').map(function(domain) {
          return domain.trim();
        });
      }

      validation.email = {
        toColumn: result.data.columns.emailMatch,
        matchColumn: result.data.columns.emailMatch,
        template: emailProviderResult || defaultEmailSettings,
        expire: $('#expire-timeout').val(),
        domain: domain,
        domains: domains
      }
      break;
  }
  // Update data source definitions
  var options = {
    id: result.data.dataSourceId,
    definition: {
      validation: validation
    }
  };
  Fliplet.DataSources.update(options)
    .then(function() {
      data.dataSourceQuery = result.data;

      // Save
      Fliplet.Widget.save(data);
    })
});

// Click to edit email template should open email provider
$('.show-email-provider').on('click', function() {
  var emailProviderData = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.email && dataSource.definition.validation.email.template || defaultEmailSettings;
  emailProvider = Fliplet.Widget.open('com.fliplet.email-provider', {
    data: emailProviderData
  });

  emailProvider.then(function onForwardEmailProvider(result) {
    emailProvider = null;
    emailProviderResult = result.data;
    Fliplet.Widget.autosize();
  });
});

$('#email-domain').on('change', function() {
  if ($(this).is(':checked')) {
    $('.email-domains-input').removeClass('hidden');
  } else {
    $('.email-domains-input').addClass('hidden');
  }
});

// Initialize data.
if (data.type === 'sms') {
  $smsSettings.removeClass('hidden');
} else {
  $emailSettings.removeClass('hidden');
}
$expireTimeoutSettings.removeClass('hidden');
