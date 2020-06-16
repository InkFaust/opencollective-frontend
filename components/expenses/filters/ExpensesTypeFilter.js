import React from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import expenseTypes from '../../../lib/constants/expenseTypes';
import { i18nExpenseType } from '../../../lib/i18n/expense';

import { ExpensesFilter } from './ExpensesFilter';

const ExpenseTypeFilter = ({ onChange, value, ...props }) => {
  const intl = useIntl();
  const getOption = value => ({ label: i18nExpenseType(intl, value), value });

  return (
    <ExpensesFilter
      minWidth={150}
      isSearchable={false}
      onChange={({ value }) => onChange(value)}
      value={getOption(value || 'ALL')}
      options={[
        getOption('ALL'),
        getOption(expenseTypes.RECEIPT),
        getOption(expenseTypes.INVOICE),
        getOption(expenseTypes.UNCLASSIFIED),
      ]}
      {...props}
    />
  );
};

ExpenseTypeFilter.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
};

export default ExpenseTypeFilter;
