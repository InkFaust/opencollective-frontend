import React from 'react';

import StyledSelect from '../../StyledSelect';

export const ExpensesFilter = props => {
  return (
    <StyledSelect
      minWidth={100}
      controlStyles={{
        borderRadius: 100,
        background: '#F7F8FA',
        padding: '0 8px',
      }}
      {...props}
    />
  );
};
