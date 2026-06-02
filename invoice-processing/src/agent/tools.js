// Gemini function-calling declaration format
export const functionDeclarations = [
  {
    name: 'record_invoice',
    description: 'Record the key fields extracted from an invoice into the database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        issuer:     { type: 'STRING', description: 'Name of the company issuing the invoice' },
        address:    { type: 'STRING', description: 'Billing address of the issuer' },
        amount_due: { type: 'NUMBER', description: 'Total amount due' },
        currency:   { type: 'STRING', description: 'Currency code, e.g. USD, EUR' },
        due_date:   { type: 'STRING', description: 'Payment due date in ISO 8601 format (YYYY-MM-DD)' },
      },
      required: ['issuer', 'amount_due', 'due_date'],
    },
  },
];
