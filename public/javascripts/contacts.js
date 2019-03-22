$(function() {
  function ContactManager() {
    this.$main = $('main');
    this.templates = [];
    this.tags = [];
    this.contacts = [];
  }
  
  ContactManager.prototype = {
    setPartials: function() {
      let $partials = $('[data-type="partial"]');
      $partials.each((i, partial) => {
        let $partial = $(partial);
        Handlebars.registerPartial($partial.attr('id'), $partial.html());
      });
    },
    
    cacheTemplates: function() {
      let $templates = $('[type="text/x-handlebars"]');
      $templates.each((i, template) => {
        let $template = $(template).remove();
        this.templates[$template.attr('id')] = Handlebars.compile($template.html());
      });
    },
    
    bindEvents: function() {
      this.$main.on('click', 'section a', this.renderCreateContact.bind(this));
      $(document).on('click', 'a.main', this.backToMain.bind(this));
      this.$main.on('submit', this.updateContacts.bind(this));
      this.$main.on('click', '.edit', this.renderEditContact.bind(this));
      this.$main.on('click', '.delete', this.deleteContact.bind(this));
      this.$main.on('input', '[name=q]', this.searchContacts.bind(this));
      this.$main.on('change', '.tags', this.handleFilter.bind(this));
    },
    
    handleFilter: function(e) {
      let $filters = $('.tags input:checked');
      let query = $('[name=q]').val();
      let currentContacts = this.getMatchingContacts(query);
      
      if ($filters.length > 0) {
        this.filterContacts($filters, currentContacts);
      } else if (query.length > 0) {
        this.renderMain(currentContacts);
      } else {
        this.renderMain(this.contacts);
      }
    },
    
    filterContacts: function($filters, currentContacts) {
      let contacts = [];
      
      $filters.each((i, filter) => {
        let tag = $(filter).val();
        currentContacts.forEach(contact => {
          let tags = contact.tags.split(',');
          if (tags.includes(tag)) {
            contacts.push(contact);
          }
        });
      });
      
      this.renderMain(contacts, true);
    },
    
    searchContacts: function(e) {
      let $input = $(e.target);
      let query = $input.val().toLowerCase();
      let contacts;
      
      if (query.length > 0) {
        contacts = this.getMatchingContacts(query);
        this.getUniqueTags(contacts);
        this.renderMain(contacts);
      } else {
        this.getUniqueTags();
        this.renderMain(this.contacts);
      }
    },
    
    getMatchingContacts: function(query) {
      let contacts = [];
      let regex = RegExp('\\b' + query);
      this.contacts.forEach(contact => {
        if (regex.test(contact.full_name.toLowerCase())) {
          contacts.push(contact);
        }
      });
      
      return contacts;
    },
    
    deleteContact: function(e) {
      e.preventDefault();
      let id = Number($(e.target).attr('data-id'));
      let contact = this.contacts.find(contact => contact.id === id);
      let confirmDelete = confirm('Do you really want to delete this contact?');
      
      const deleteContact = function() {
        this.updateContact(contact, 'delete');
        this.getUniqueTags();
        this.renderMain();
      }.bind(this);
      
      if (confirmDelete) {
        $.ajax({
          url: '/api/contacts/' + id,
          type: 'delete',
          success: deleteContact
        });
      }
    },
    
    renderCreateContact: function(e) {
      e.preventDefault();
      this.$main.slideUp(400, () => {
        this.$main.html(this.templates.create_contact()).slideDown(400);;
      });
    },
    
    renderEditContact: function(e) {
      e.preventDefault();
      let id = Number($(e.target).attr('data-id'));
      let contact = this.contacts.find(contact => contact.id === id);
      this.$main.slideUp(400, () => {
        this.$main.html(this.templates.edit_contact(contact)).slideDown(400);;
      });
    },
    
    backToMain: function(e) {
      e.preventDefault();
      
      if (this.$main.find('section').length > 0) {
        this.renderMain();
      } else {
        this.$main.slideUp(400, () => {
          this.renderMain();
          this.$main.slideDown();
        });
      }
    },
    
    updateContacts: function(e) {
      e.preventDefault();
      let $form = $(e.target);
      let json = this.getJSON($form.serializeArray());
      
      const updateContacts = function(contactJSON) {
        this.updateContact(contactJSON, $form.attr('method'));
        this.getUniqueTags();
        this.backToMain(e);
      }.bind(this);

      $.ajax({
        url: $form.attr('action'),
        type: $form.attr('method'),
        data: json,
        success: updateContacts
      });
    },
    
    updateContact: function(contact, method) {
      if (method === 'post') {
        this.contacts.push(contact);
      } else if (method === 'put') {
        this.contacts.forEach((currentContact, index) => {
          if (currentContact.id === contact.id) {
            this.contacts[index] = contact;
            return false;
          }
        });
      } else {
        this.contacts.forEach((currentContact, index) => {
          if (currentContact.id === contact.id) {
            this.contacts.splice(index, 1);
            return false;
          }
        });
      }
    },
    
    getJSON: function(formData) {
      let json = {};
      formData.forEach(data => {
        if (data.name === 'tags') {
          let tagString = data.value.split(', ').join(',');
          json[data.name] = tagString;
        } else {
          json[data.name] = data.value;
        }
      });
      
      return json;
    },
    
    getContacts: function() {
      const populateContacts = function(contacts) {
        this.contacts = contacts;
        this.getUniqueTags();
        this.renderMain();
      }.bind(this);
      
      $.ajax({
        url: '/api/contacts',
        success: populateContacts
      });
    },
    
    getUniqueTags: function(contacts = this.contacts) {
      let tags = [];
      
      contacts.forEach(contact => {
        if (contact.tags) {
          let contactTags = contact.tags.split(',');
          contactTags.forEach(tag => {
            if (!tags.includes(tag)) {
              tags.push(tag);
            }
          });
        }
      });
      
      this.tags = tags;
    },
    
    renderMain: function(contacts, keepCurrentTags = false) {    
      if (contacts) {
        this.$main.find('ul').replaceWith(this.templates.contacts({ contacts: contacts }));
      } else {
        this.$main.empty();
        this.$main.append(this.templates.add_search());
        if (this.contacts.length > 0) {
          this.$main.append(this.templates.contacts({ contacts: this.contacts }));
        } else {
          this.$main.append(this.templates.no_contacts());
        }
      }
      
      if (!keepCurrentTags) {
        this.$main.find('.tags').html(this.templates.tags({ tags: this.tags }));
      }
    },
    
    init: function() {
      this.setPartials();
      this.cacheTemplates();
      this.bindEvents();
      this.getContacts();
    },
    
    constructor: ContactManager
  };
  
  const manager = new ContactManager();
  manager.init();
});