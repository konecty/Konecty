if (typeof MochaWeb !== 'undefined' && MochaWeb !== null) {
  MochaWeb.testOnly(() =>
    describe('Server initialization', function() {
      it('should have 0 MetaObjects', () => chai.expect(MetaObject.find().count()).to.be.equal(0));

      it('should have MetaObejcts', function() {
        MetaObject.insert({
          _id: 'Contact',
          fields: {
            fromLead: {
              type: 'boolean',
              name: 'fromLead',
              label: { pt_BR: 'De Lead', en: 'From Lead' },
              isSortable: true,
              isInherited: true
            },
            queue: {
              type: 'lookup',
              name: 'queue',
              label: { en: 'Queue', pt_BR: 'Roleta' },
              document: 'Queue',
              descriptionFields: ['name'],
              isInherited: true
            },
            campaign: {
              document: 'Campaign',
              descriptionFields: ['code', 'name', 'type'],
              type: 'lookup',
              name: 'campaign',
              label: { en: 'Campaign', pt_BR: 'Campanha' },
              isSortable: true,
              isInherited: true
            },
            referrerURL: {
              name: 'referrerURL',
              label: { en: 'Referrer URL', pt_BR: 'Referrer URL' },
              type: 'url',
              isInherited: true
            },
            facebookData: {
              label: { en: 'Facebook Data', pt_BR: 'Dados do Facebook' },
              type: 'json',
              name: 'facebookData',
              isInherited: true
            },
            googleData: {
              type: 'json',
              name: 'googleData',
              label: { en: 'Google Data', pt_BR: 'Dados do Google' },
              isInherited: true
            },
            doNotCall: {
              type: 'picklist',
              label: { pt_BR: 'Não Telefonar', en: 'Do Not Call' },
              maxSelected: 3,
              minSelected: 0,
              name: 'doNotCall',
              options: {
                Noite: { en: 'Night', pt_BR: 'Noite' },
                Manhã: { en: 'Morning', pt_BR: 'Manhã' },
                Tarde: { en: 'Afternoon', pt_BR: 'Tarde' }
              },
              optionsSorter: 'asc',
              renderAs: 'without_scroll',
              isInherited: true
            },
            maritalStatus: {
              options: {
                'Casado(a)': { pt_BR: 'Casado(a)' },
                'Divorciado(a)': { pt_BR: 'Divorciado(a)' },
                'Solteiro(a)': { pt_BR: 'Solteiro(a)' },
                'União Estável': { pt_BR: 'União Estável' },
                'Viúvo(a)': { pt_BR: 'Viúvo(a)' }
              },
              optionsSorter: 'asc',
              renderAs: 'with_scroll',
              type: 'picklist',
              label: { en: 'Marital Status', pt_BR: 'Estado Civil' },
              maxSelected: 1,
              minSelected: 0,
              name: 'maritalStatus',
              isInherited: true
            },
            staff: {
              isList: true,
              document: 'Contact',
              descriptionFields: ['code', 'name.full'],
              detailFields: ['phone', 'email'],
              type: 'lookup',
              name: 'staff',
              label: { en: 'Staff', pt_BR: 'Funcionários' },
              isInherited: true
            },
            type: {
              name: 'type',
              options: {
                Cliente: { pt_BR: 'Cliente', en: 'Client' },
                Competidor: { pt_BR: 'Competidor' },
                Fornecedor: { pt_BR: 'Fornecedor', en: 'Supplier' },
                Psicólogo: { en: 'Psychologist', pt_BR: 'Psicólogo' },
                Funcionário: { en: 'Staff', pt_BR: 'Funcionário' }
              },
              optionsSorter: 'asc',
              renderAs: 'without_scroll',
              type: 'picklist',
              label: { en: 'Type', pt_BR: 'Tipo' },
              maxSelected: 4,
              minSelected: 1,
              isInherited: true
            },
            address: {
              isList: true,
              isSortable: true,
              isTypeOptionsEditable: true,
              label: { en: 'Address', pt_BR: 'Endereço' },
              name: 'address',
              type: 'address',
              typeOptions: { Casa: { en: 'Home', pt_BR: 'Casa' }, Trabalho: { en: 'Work', pt_BR: 'Trabalho' } },
              isInherited: true
            },
            password: {
              type: 'encrypted',
              name: 'password',
              label: { en: 'Password', pt_BR: 'Senha' },
              isSortable: true,
              isInherited: true
            },
            birthdate: {
              isSortable: true,
              type: 'date',
              name: 'birthdate',
              label: { en: 'Birthdate', pt_BR: 'Data de Nascimento' },
              isInherited: true
            },
            code: {
              isUnique: true,
              isSortable: true,
              type: 'autoNumber',
              name: 'code',
              label: { pt_BR: 'Código', en: 'Code' },
              isInherited: true
            },
            email: {
              type: 'email',
              typeOptions: { Pessoal: { en: 'Personal', pt_BR: 'Pessoal' }, Trabalho: { en: 'Work', pt_BR: 'Trabalho' } },
              isList: true,
              isSortable: true,
              isTypeOptionsEditable: true,
              label: { en: 'Email', pt_BR: 'Email' },
              name: 'email',
              isInherited: true
            },
            emailFrequence: {
              name: 'emailFrequence',
              optionsSorter: 'asc',
              defaultValues: [{ pt_BR: 'Dia' }],
              maxSelected: 1,
              minSelected: 0,
              renderAs: 'with_scroll',
              type: 'picklist',
              isSortable: true,
              label: { en: 'Email Frequence', pt_BR: 'Frequencia de Email' },
              options: {
                Nunca: { pt_BR: 'Nunca' },
                Dia: { pt_BR: 'Dia' },
                Semana: { pt_BR: 'Semana' },
                'Duas Semanas': { pt_BR: 'Duas Semanas' },
                Mês: { pt_BR: 'Mês' }
              },
              isInherited: true
            },
            gender: {
              minSelected: 0,
              name: 'gender',
              optionsSorter: 'asc',
              maxSelected: 1,
              label: { en: 'Gender', pt_BR: 'Sexo' },
              options: {
                Desconhecido: { en: 'Unknown', pt_BR: 'Desconhecido' },
                'Não se Aplica': { en: 'Not Applicable', pt_BR: 'Não se Aplica' },
                Masculino: { en: 'Male', pt_BR: 'Masculino' },
                Feminino: { pt_BR: 'Feminino', en: 'Female' }
              },
              renderAs: 'without_scroll',
              type: 'picklist',
              isSortable: true,
              isInherited: true
            },
            legalPerson: {
              label: { en: 'Legal Person', pt_BR: 'Pessoa Jurídica' },
              isSortable: true,
              type: 'boolean',
              name: 'legalPerson',
              isInherited: true
            },
            mailFrequence: {
              isSortable: true,
              label: { pt_BR: 'Frequencia de Correspondência', en: 'Mail Frequence' },
              options: {
                Dia: { pt_BR: 'Dia' },
                Semana: { pt_BR: 'Semana' },
                'Duas Semanas': { pt_BR: 'Duas Semanas' },
                Mês: { pt_BR: 'Mês' },
                Nunca: { pt_BR: 'Nunca' }
              },
              renderAs: 'with_scroll',
              type: 'picklist',
              defaultValues: [{ pt_BR: 'Dia' }],
              maxSelected: 1,
              minSelected: 0,
              name: 'mailFrequence',
              optionsSorter: 'asc',
              isInherited: true
            },
            name: {
              type: 'personName',
              name: 'name',
              label: { en: 'Name', pt_BR: 'Nome' },
              isRequired: true,
              isSortable: true,
              isInherited: true
            },
            verificationToken: {
              type: 'text',
              name: 'verificationToken',
              label: { pt_BR: 'Token de Verificação', en: 'Verification Token' },
              isSortable: true,
              isInherited: true
            },
            notes: { type: 'text', name: 'notes', label: { en: 'Notes', pt_BR: 'Observação' }, isInherited: true },
            phone: {
              label: { en: 'Phone', pt_BR: 'Telefone' },
              name: 'phone',
              type: 'phone',
              typeOptions: {
                Casa: { en: 'Home', pt_BR: 'Casa' },
                Celular: { en: 'Mobile', pt_BR: 'Celular' },
                Trabalho: { en: 'Work', pt_BR: 'Trabalho' },
                Fax: { pt_BR: 'Fax', en: 'Fax' }
              },
              isList: true,
              isSortable: true,
              isTypeOptionsEditable: true,
              isInherited: true
            },
            picture: {
              label: { en: 'Picture', pt_BR: 'Imagem' },
              isSortable: true,
              isList: true,
              wildcard: '(jpg|jpeg|png)',
              maxSize: 2048,
              type: 'file',
              name: 'picture',
              isInherited: true
            },
            smsFrequence: {
              label: { en: 'SMS Frequence', pt_BR: 'Frequencia de SMS' },
              options: {
                Mês: { pt_BR: 'Mês' },
                Nunca: { pt_BR: 'Nunca' },
                Dia: { pt_BR: 'Dia' },
                Semana: { pt_BR: 'Semana' },
                'Duas Semanas': { pt_BR: 'Duas Semanas' }
              },
              renderAs: 'with_scroll',
              type: 'picklist',
              isSortable: true,
              maxSelected: 1,
              minSelected: 0,
              name: 'smsFrequence',
              optionsSorter: 'asc',
              defaultValues: [{ pt_BR: 'Dia' }],
              isInherited: true
            },
            status: {
              optionsSorter: 'none',
              maxSelected: 1,
              minSelected: 1,
              name: 'status',
              renderAs: 'without_scroll',
              type: 'picklist',
              isSortable: true,
              label: { en: 'Status', pt_BR: 'Situação' },
              options: {
                Faleceu: { pt_BR: 'Faleceu', en: 'Deceased' },
                Duplicado: { en: 'Duplicate', pt_BR: 'Duplicado' },
                Ativo: { en: 'Active', pt_BR: 'Ativo' },
                'Ativo - Convertido': { en: 'Active - Converted', pt_BR: 'Ativo - Convertido' },
                Lead: { en: 'Lead - New', pt_BR: 'Lead' },
                Descadastrado: { en: 'Unregistered', pt_BR: 'Descadastrado' },
                'Lead - Tentando': { en: 'Lead - Attempting', pt_BR: 'Lead - Tentando' },
                'Lead - Inválida': { en: 'Lead - Invalid', pt_BR: 'Lead - Inválida' },
                Inativo: { en: 'Inactive', pt_BR: 'Inativo' }
              },
              isInherited: true
            },
            _createdAt: {
              type: 'dateTime',
              name: '_createdAt',
              label: { pt_BR: 'Criado em', en: 'Created At' },
              isSortable: true,
              isInherited: true
            },
            _createdBy: {
              label: { en: 'Created by', pt_BR: 'Criado por' },
              isSortable: true,
              document: 'User',
              descriptionFields: ['name', 'group.name'],
              type: 'lookup',
              name: '_createdBy',
              isInherited: true
            },
            _updatedAt: {
              type: 'dateTime',
              name: '_updatedAt',
              label: { en: 'Updated At', pt_BR: 'Atualizado em' },
              isSortable: true,
              isInherited: true
            },
            _updatedBy: {
              name: '_updatedBy',
              label: { en: 'Updated by', pt_BR: 'Atualizado por' },
              document: 'User',
              descriptionFields: ['name', 'group.name'],
              type: 'lookup',
              isInherited: true
            },
            _user: {
              isSortable: true,
              isList: true,
              document: 'User',
              descriptionFields: ['name', 'group.name', 'active'],
              detailFields: ['phone', 'emails'],
              type: 'lookup',
              name: '_user',
              label: { en: 'User', pt_BR: 'Usuário' },
              isInherited: true
            },
            jobCount: {
              label: { en: 'Job Count', pt_BR: 'Quantidade de Vagas Ativas' },
              isSortable: true,
              type: 'number',
              name: 'jobCount'
            },
            recruiterName: {
              type: 'text',
              name: 'recruiterName',
              label: { en: 'Recruiter Name', pt_BR: 'Nome do Gestor de Vagas' }
            },
            recruiterRole: {
              type: 'text',
              name: 'recruiterRole',
              label: { en: 'Recruiter Role', pt_BR: 'Cargo do Gestor de Vagas' }
            },
            cnh: { type: 'number', name: 'cnh', label: { en: 'CNH', pt_BR: 'CNH' } },
            cnpj: { type: 'text', name: 'cnpj', label: { en: 'CNPJ', pt_BR: 'CNPJ' }, size: 15 },
            corporateName: {
              type: 'text',
              name: 'corporateName',
              label: { en: 'Corporate Name', pt_BR: 'Razão Social' },
              help: {}
            },
            cpf: { name: 'cpf', label: { en: 'CPF', pt_BR: 'CPF' }, type: 'text' },
            rg: { label: { en: 'RG', pt_BR: 'RG' }, type: 'text', name: 'rg' },
            rgEm: { type: 'text', name: 'rgEm', label: { en: 'RG Issued by', pt_BR: 'RG Orgão Emissor' } },
            stateRegistration: {
              type: 'text',
              name: 'stateRegistration',
              label: { en: 'State Registration', pt_BR: 'Inscrição Estadual' },
              help: {}
            },
            login: {
              type: 'lookup',
              name: 'login',
              label: { en: 'Login', pt_BR: 'Login' },
              document: 'User',
              descriptionFields: ['username', 'emails']
            }
          },
          icon: 'book',
          label: { en: 'Contact', pt_BR: 'Contato' },
          menuSorter: 3,
          name: 'Contact',
          namespace: ['base', 'egalite'],
          plurals: { en: 'Contacts', pt_BR: 'Contatos' },
          saveHistory: true,
          type: 'document',
          login: {
            allow: true,
            field: 'login',
            defaultValues: {
              active: true,
              group: { _id: '50fc9c8ae4b06c1852923ffe' },
              locale: 'pt_BR',
              role: { _id: '50a28a36e4b00438f136ae48' },
              source: 'Contact'
            }
          },
          parent: 'base:Contact',
          relations: [
            {
              label: { en: 'Jobs', pt_BR: 'Vagas' },
              document: 'Job',
              lookup: 'contact',
              filter: { match: 'and', conditions: [{ term: 'status', value: 'Ativo', operator: 'equals' }] },
              aggregators: { jobCount: { aggregator: 'count' } },
              name: 'Jobs'
            }
          ]
        });
        chai.expect(MetaObject.findOne('Contact')).to.be.a('Object');

        MetaObject.insert({
          _id: 'User',
          collection: 'users',
          description: { en: 'System users', pt_BR: 'Usuários do sistema' },
          fields: {
            active: {
              defaultValue: true,
              type: 'boolean',
              name: 'active',
              label: { en: 'Active', pt_BR: 'Ativo' },
              isRequired: true,
              isSortable: true,
              isInherited: true
            },
            nickname: { label: { en: 'Nickname', pt_BR: 'Apelido' }, type: 'text', name: 'nickname', isInherited: true },
            pictures: {
              type: 'file',
              name: 'pictures',
              label: { en: 'Pictures', pt_BR: 'Imagens' },
              isList: true,
              wildcard: '(jpg|jpeg)',
              isInherited: true
            },
            address: {
              typeOptions: { Casa: { en: 'Home', pt_BR: 'Casa' }, Trabalho: { en: 'Work', pt_BR: 'Trabalho' } },
              isList: true,
              isSortable: true,
              isTypeOptionsEditable: true,
              label: { pt_BR: 'Endereço', en: 'Address' },
              name: 'address',
              type: 'address',
              isInherited: true
            },
            birthdate: {
              label: { en: 'Birthdate', pt_BR: 'Data de Nascimento' },
              isSortable: true,
              type: 'date',
              name: 'birthdate',
              isInherited: true
            },
            code: {
              type: 'autoNumber',
              name: 'code',
              label: { en: 'Code', pt_BR: 'Código' },
              isUnique: true,
              isSortable: true,
              isInherited: true
            },
            dashboard: {
              type: 'text',
              name: 'dashboard',
              label: { en: 'Dashboard', pt_BR: 'Dashboard' },
              isSortable: true,
              isInherited: true
            },
            emails: {
              isList: true,
              isSortable: true,
              label: { en: 'Email', pt_BR: 'Email' },
              name: 'emails',
              type: 'email',
              isInherited: true
            },
            entry: { label: { en: 'Entry', pt_BR: 'Entrada' }, isSortable: true, type: 'date', name: 'entry', isInherited: true },
            exit: { type: 'date', name: 'exit', label: { en: 'Exit', pt_BR: 'Saída' }, isSortable: true, isInherited: true },
            gender: {
              maxSelected: 1,
              minSelected: 0,
              name: 'gender',
              optionsSorter: 'asc',
              isSortable: true,
              label: { pt_BR: 'Sexo', en: 'Gender' },
              options: {
                Masculino: { en: 'Male', pt_BR: 'Masculino' },
                Feminino: { en: 'Female', pt_BR: 'Feminino' },
                Desconhecido: { en: 'Unknown', pt_BR: 'Desconhecido' },
                'Não se Aplica': { en: 'Not Applicable', pt_BR: 'Não se Aplica' }
              },
              renderAs: 'without_scroll',
              type: 'picklist',
              isInherited: true
            },
            group: {
              label: { en: 'Group', pt_BR: 'Grupo' },
              isRequired: true,
              isSortable: true,
              document: 'Group',
              descriptionFields: ['name'],
              type: 'lookup',
              name: 'group',
              isInherited: true
            },
            groups: {
              type: 'lookup',
              name: 'groups',
              label: { en: 'Extra Access Groups', pt_BR: 'Grupos de Acesso Extra' },
              isSortable: true,
              isList: true,
              document: 'Group',
              descriptionFields: ['name'],
              isInherited: true
            },
            admin: { type: 'boolean', name: 'admin', label: { en: 'Administrator', pt_BR: 'Administrador' }, isInherited: true },
            jobTitle: {
              type: 'text',
              name: 'jobTitle',
              label: { en: 'Job Title', pt_BR: 'Cargo' },
              isSortable: true,
              normalization: 'title',
              isInherited: true
            },
            lastLogin: {
              type: 'dateTime',
              name: 'lastLogin',
              label: { en: 'Last Login', pt_BR: 'Último Login' },
              isSortable: true,
              isInherited: true
            },
            locale: {
              isSortable: true,
              label: { en: 'Locale', pt_BR: 'Opções Regionais' },
              options: { pt_BR: { en: 'pt_BR', pt_BR: 'pt_BR' }, en: { en: 'en', pt_BR: 'en' } },
              renderAs: 'with_scroll',
              type: 'picklist',
              isRequired: true,
              maxSelected: 1,
              minSelected: 0,
              name: 'locale',
              optionsSorter: 'asc',
              isInherited: true
            },
            username: {
              isRequired: true,
              isSortable: true,
              isUnique: true,
              label: { pt_BR: 'Login', en: 'Login' },
              name: 'username',
              normalization: 'lower',
              type: 'text',
              isInherited: true
            },
            name: {
              label: { en: 'Name', pt_BR: 'Nome' },
              isSortable: true,
              normalization: 'title',
              type: 'text',
              name: 'name',
              isInherited: true
            },
            password: {
              type: 'password',
              name: 'password',
              label: { en: 'Password', pt_BR: 'Senha' },
              isRequired: false,
              isSortable: true,
              isInherited: true
            },
            access: { type: 'json', name: 'access', label: { en: 'Access', pt_BR: 'Acesso' }, isInherited: true },
            phone: {
              name: 'phone',
              isList: true,
              isSortable: true,
              isTypeOptionsEditable: true,
              label: { en: 'Phone', pt_BR: 'Telefone' },
              type: 'phone',
              typeOptions: {
                Casa: { en: 'Home', pt_BR: 'Casa' },
                Celular: { pt_BR: 'Celular', en: 'Mobile' },
                Trabalho: { en: 'Work', pt_BR: 'Trabalho' },
                Fax: { en: 'Fax', pt_BR: 'Fax' }
              },
              minItems: 0,
              maxItems: 10,
              isInherited: true
            },
            role: {
              descriptionFields: ['name'],
              inheritedFields: [{ fieldName: 'admin', inherit: 'always' }, { inherit: 'always', fieldName: 'access' }],
              type: 'lookup',
              name: 'role',
              label: { en: 'Role', pt_BR: 'Papel' },
              isRequired: true,
              isSortable: true,
              document: 'Role',
              isInherited: true
            },
            sessionExpireAfterMinutes: {
              isSortable: true,
              type: 'number',
              name: 'sessionExpireAfterMinutes',
              label: { pt_BR: 'Sessão Expirará em ', en: 'Session Expire After Minutes' },
              isInherited: true
            },
            _createdAt: {
              label: { en: 'Created At', pt_BR: 'Criado em' },
              isSortable: true,
              type: 'dateTime',
              name: '_createdAt',
              isInherited: true
            },
            _createdBy: {
              type: 'lookup',
              name: '_createdBy',
              label: { en: 'Created by', pt_BR: 'Criado por' },
              isSortable: true,
              document: 'User',
              descriptionFields: ['name', 'group.name'],
              isInherited: true
            },
            _updatedAt: {
              type: 'dateTime',
              name: '_updatedAt',
              label: { pt_BR: 'Atualizado em', en: 'Updated At' },
              isSortable: true,
              isInherited: true
            },
            _updatedBy: {
              label: { en: 'Updated by', pt_BR: 'Atualizado por' },
              document: 'User',
              descriptionFields: ['name', 'group.name'],
              type: 'lookup',
              name: '_updatedBy',
              isInherited: true
            },
            statusDefault: {
              type: 'picklist',
              name: 'statusDefault',
              label: { en: 'Default Status', pt_BR: 'Situação Padrão' },
              options: {
                online: { en: 'Online', pt_BR: 'Online', sort: 1 },
                away: { en: 'Away', pt_BR: 'Ausente', sort: 2 },
                busy: { en: 'Busy', pt_BR: 'Ocupado', sort: 3 },
                offline: { en: 'Invisible', pt_BR: 'Invisível', sort: 4 }
              },
              renderAs: 'without_scroll',
              minSelected: 0,
              maxSelected: 1,
              optionsSorter: 'sort',
              isInherited: true
            },
            status: {
              type: 'picklist',
              name: 'status',
              label: { en: 'Status', pt_BR: 'Situação' },
              options: {
                online: { en: 'Online', pt_BR: 'Online', sort: 1 },
                away: { en: 'Away', pt_BR: 'Ausente', sort: 2 },
                busy: { en: 'Busy', pt_BR: 'Ocupado', sort: 3 },
                offline: { en: 'Offline', pt_BR: 'Desconectado', sort: 4 }
              },
              renderAs: 'without_scroll',
              minSelected: 0,
              maxSelected: 1,
              optionsSorter: 'sort',
              isSortable: true,
              isInherited: true
            },
            _user: {
              descriptionFields: ['name', 'group.name', 'active'],
              detailFields: ['phone', 'emails'],
              type: 'lookup',
              name: '_user',
              label: { en: 'User', pt_BR: 'Usuário' },
              isSortable: true,
              isList: true,
              document: 'User',
              isInherited: true
            },
            contact: {
              type: 'lookup',
              name: 'contact',
              label: { en: 'Contact', pt_BR: 'Contato' },
              isSortable: true,
              document: 'Contact',
              descriptionFields: ['code', 'name']
            },
            source: { type: 'text', name: 'source', label: { en: 'Source', pt_BR: 'Origem' } }
          },
          help: {
            en: 'Use this module to manage the system users, organize them into groups, assigne roles and grant access',
            pt_BR:
              'Use este módulo para administrar os usuários do sistema, organiza-los em grupos, atribuir papéis e conceder acesso'
          },
          icon: 'user',
          label: { en: 'User', pt_BR: 'Usuário' },
          menuSorter: 10,
          name: 'User',
          namespace: ['base', 'egalite'],
          plurals: { en: 'Users', pt_BR: 'Usuários' },
          saveHistory: true,
          type: 'document',
          parent: 'base:User'
        });
        chai.expect(MetaObject.findOne('User')).to.be.a('Object');

        MetaObject.insert({
          _id: 'Default:access:Full',
          changePassword: true,
          changeUser: true,
          replaceUser: true,
          addUser: true,
          removeUser: true,
          defineUser: true,
          removeInactiveUser: true,
          document: 'Default',
          export: {
            html: ['view', 'list', 'pivot'],
            pdf: ['view', 'list', 'pivot'],
            csv: ['view', 'list', 'pivot'],
            xml: ['view', 'list', 'pivot'],
            xls: ['view', 'list', 'pivot']
          },
          fieldDefaults: { isDeletable: true, isCreatable: true, isUpdatable: true, isReadable: true },
          isCreatable: true,
          isDeletable: true,
          isReadable: true,
          isUpdatable: true,
          label: { en: 'Full', pt_BR: 'Total' },
          name: 'Full',
          namespace: ['base'],
          type: 'access'
        });
        chai.expect(MetaObject.findOne('Default:access:Full')).to.be.a('Object');

        MetaObject.insert({
          _id: 'Namespace',
          active: true,
          locale: null,
          logoURL: 'http://cdn-www.egalite.com.br/resources/images/design/header_logo.png',
          name: 'Egalitê',
          onCreate: null,
          onUpdate: null,
          sendAlertEmail: false,
          siteURL: 'http://www.egalite.com.br/',
          status: null,
          trackUserGeolocation: false,
          watermark: null,
          parents: ['base'],
          version: 2,
          emailServers: {
            smtp_egalite: {
              host: 'smtp.egalite.com.br',
              port: 587,
              auth: { user: 'administrator@egalite.com.br', pass: 'Eg@l1te1234' },
              secure: true,
              ignoreTLS: true
            }
          },
          type: 'namespace',
          ns: 'egalite'
        });
        chai.expect(MetaObject.findOne('Namespace')).to.be.a('Object');

        chai.expect(MetaObject.find().count()).to.be.equal(4);
      });

      it('should have User collection', () =>
        // chai.expect(Object.keys(Models).join(',')).to.be.a('Object')
        chai.expect(Meteor.users).to.be.a('Object'));

      it('should have 0 Users', () => chai.expect(Meteor.users.find().count()).to.be.equal(0));

      it('should have Users', function() {
        Accounts.createUser({
          username: 'test',
          password: 'test'
        });

        Meteor.users.update(
          { username: 'test' },
          {
            $set: {
              admin: true,
              active: true,
              access: {
                defaults: ['Full']
              }
            }
          }
        );

        chai.expect(Meteor.users.find().count()).to.be.equal(1);
      });
    })
  );
}
