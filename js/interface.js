var widgetInstanceId = $('[data-widget-id]').data('widget-id');
var data = Fliplet.Widget.getData(widgetInstanceId) || {};

var $expireTimeoutSettings = $('.expire-timeout-settings');
var $emailSettings = $('.email-settings');
var $smsSettings = $('.sms-settings');

var defaultEmailTemplate = $('#email-template-default').html();
var defaultEmailSettings = {
  subject: 'Verify your email address',
  html: defaultEmailTemplate,
  to: []
};

var defaultSmsTemplate = 'Your code: {{ code }} (it will expire in {{ expireDescription }})';

// Default expire timeout 2 days
var defaultExpireTimeout = 2880;
var dataSource;

var emailProvider;

Fliplet.Widget.onCancelRequest(function() {
  emailProvider.close();
  emailProvider = null;

  Fliplet.Widget.toggleCancelButton(true);
  Fliplet.Widget.resetSaveButtonLabel();
});

Fliplet.Widget.onSaveRequest(function() {
  if (!dataSource || dataSource.value === null) {
    return Fliplet.Widget.save({});
  }

  if (emailProvider) {
    return emailProvider.forwardSaveRequest();
  }

  return dsQueryProvider.forwardSaveRequest();
});

// Set current data source and fill in fields

function selectDataSource(ds) {
  dataSource = ds;

  var sms = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.sms || {};
  var email = dataSource.definition && dataSource.definition.validation && dataSource.definition.validation.email || {};

  if (data.type === 'email') {
    setReadableExpirePeriod(email.expire || defaultExpireTimeout);
  } else if (data.type === 'sms') {
    setReadableExpirePeriod(sms.expire || defaultExpireTimeout);
  }

  $('#sms-template').val(sms.template || defaultSmsTemplate);

  if (email.domain) {
    $('#email-domain').prop('checked', true).trigger('change');
    $('#email-domains').val(email.domains.join(', '));
  }

  Fliplet.Widget.autosize();
}

// Converts minutes to hours or days or weeks
function setReadableExpirePeriod(value) {
  var timeInterval = '1';

  if (value % 60 === 0 && value > 0) {
    // Converts to hours
    value = value / 60;
    timeInterval = '60';

    if (value % 24 === 0) {
      // Converts to days
      value = value / 24;
      timeInterval = '1440';

      if (value % 7 === 0) {
        // Converts to weeks
        value = value / 7;
        timeInterval = '10080';
      }
    }
  }

  $('#expire-timeout').val(value);
  $('#time-value').val(timeInterval);
}

// Converts time to minutes depending on selected hours or days or weeks
function convertTimeToMinutes() {
  var inputValue = $('#expire-timeout').val();
  var selectValue = $('#time-value').val();
  return inputValue * selectValue;
}

var dsQueryData = {};
switch (data.type) {
  case 'sms':
    dsQueryData = {
      settings: {
        dataSourceLabel: 'Select the data source containing the user information',
        dataSourceSubtitle: 'SMS verification data for ' + Fliplet.Env.get('appName'),
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
        }]
      },
      result: data.dataSourceQuery
    };
    break;

  case 'email':
  default:
    dsQueryData = {
      settings: {
        dataSourceLabel: 'Select the data source containing the user information',
        dataSourceSubtitle: 'Email verification data for ' + Fliplet.Env.get('appName'),
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
  // If there is no data source just save it although not valid config
  if (!dataSource) {
    Fliplet.Widget.save();
  }

  var validation = (dataSource.definition && dataSource.definition.validation) ? dataSource.definition.validation : {};

  // Let's update only the selected verification type on the datasurce settings
  switch (data.type) {
    case 'sms':
      validation.sms = {
        toColumn: result.data.columns.smsTo,
        matchColumn: result.data.columns.smsMatch,
        template: $('#sms-template').val(),
        expire: convertTimeToMinutes()
      };
      break;

    case 'email':
      // Domains should be comma separated
      var domains = [];
      var domain = $('#email-domain').is(':checked');
      var domainsString = $('#email-domains').val().trim();

      if (domainsString) {
        domains = domainsString.split(',').map(function(domain) {
          return domain.trim();
        });
      }

      validation.email = {
        toColumn: result.data.columns.emailMatch,
        matchColumn: result.data.columns.emailMatch,
        template: validation.email ? validation.email.template : defaultEmailSettings,
        expire: convertTimeToMinutes(),
        domain: domain,
        domains: domains
      };
      break;
    default:
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
    });
});

// Click to edit email template should open email provider
$('.show-email-provider').on('click', function() {
  if (!dataSource || dataSource.value === null) {
    Fliplet.Modal.alert({
      message: 'Please select a data source to configure email template'
    });
    return;
  }

  var emailProviderData = _.get(dataSource, 'definition.validation.email.template', defaultEmailSettings);

  emailProviderData.options = {
    usage: {
      code: 'Insert the verification code <strong>(Required)</strong>',
      appName: 'Insert your app name',
      organisationName: 'insert your organisation name',
      expireDescription: 'Insert the expiration time of the verification code'
    },
    hideTo: true,
    hideBCC: true,
    hideCC: true
  };

  emailProvider = Fliplet.Widget.open('com.fliplet.email-provider', {
    data: emailProviderData
  });

  Fliplet.Widget.toggleCancelButton(false);

  Fliplet.Studio.emit('widget-save-label-update', {
    text: 'Save'
  });

  emailProvider.then(function onForwardEmailProvider(result) {
    emailProvider = null;

    var dataSourceTemplate = _.get(dataSource, 'definition.validation.email.template', false);

    if (dataSourceTemplate) {
      dataSource.definition.validation.email.template = result.data;
    }

    Fliplet.Widget.autosize();
    Fliplet.Studio.emit('widget-save-label-update', {
      text: 'Save & Close'
    });
  });
});

$('#email-domain').on('change', function() {
  if ($(this).is(':checked')) {
    $('.email-domains-input').removeClass('hidden');
  } else {
    $('.email-domains-input').addClass('hidden');
  }
  Fliplet.Widget.autosize();
});

// Preveting entering invalid values in the expiration input
$('#expire-timeout').on('keydown', function(event) {
  return event.keyCode === 8 || /[0-9]+/.test(event.key);
});

// Initialize data.
if (data.type === 'sms') {
  $smsSettings.removeClass('hidden');
} else {
  $emailSettings.removeClass('hidden');
}
$expireTimeoutSettings.removeClass('hidden');
