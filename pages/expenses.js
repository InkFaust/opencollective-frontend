import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from '@apollo/react-hoc';
import { has, mapValues, pick } from 'lodash';
import memoizeOne from 'memoize-one';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';

import hasFeature, { FEATURES } from '../lib/allowed-features';
import expenseStatus from '../lib/constants/expense-status';
import expenseTypes from '../lib/constants/expenseTypes';
import { PayoutMethodType } from '../lib/constants/payout-method';
import { generateNotFoundError } from '../lib/errors';
import { API_V2_CONTEXT, gqlV2 } from '../lib/graphql/helpers';
import { Router } from '../server/pages';

import { Sections } from '../components/collective-page/_constants';
import CollectiveNavbar from '../components/CollectiveNavbar';
import Container from '../components/Container';
import ErrorPage from '../components/ErrorPage';
import ExpensesFilters from '../components/expenses/ExpensesFilters';
import ExpensesList from '../components/expenses/ExpensesList';
import ExpenseTags from '../components/expenses/ExpenseTags';
import ExpenseTypeTag from '../components/expenses/ExpenseTypeTag';
import { parseAmountRange } from '../components/expenses/filters/ExpensesAmountFilter';
import { Box, Flex } from '../components/Grid';
import Link from '../components/Link';
import LoadingPlaceholder from '../components/LoadingPlaceholder';
import MessageBox from '../components/MessageBox';
import Page from '../components/Page';
import PageFeatureNotSupported from '../components/PageFeatureNotSupported';
import Pagination from '../components/Pagination';
import StyledHr from '../components/StyledHr';
import { H1, H5 } from '../components/Text';

import ExpenseInfoSidebar from './ExpenseInfoSidebar';

const messages = defineMessages({
  title: {
    id: 'ExpensesPage.title',
    defaultMessage: '{collectiveName} · Expenses',
  },
});

const EXPENSES_PER_PAGE = 10;

class ExpensePage extends React.Component {
  static getInitialProps({ query }) {
    const { parentCollectiveSlug, collectiveSlug, offset, limit, type, status, tag, amount, payout } = query;
    return {
      parentCollectiveSlug,
      collectiveSlug,
      query: {
        offset: parseInt(offset) || undefined,
        limit: parseInt(limit) || undefined,
        type: has(expenseTypes, type) ? type : undefined,
        status: has(expenseStatus, status) ? status : undefined,
        payout: has(PayoutMethodType, payout) ? payout : undefined,
        amount,
        tag,
      },
    };
  }

  static propTypes = {
    collectiveSlug: PropTypes.string,
    parentCollectiveSlug: PropTypes.string,
    query: PropTypes.shape({
      type: PropTypes.string,
      tag: PropTypes.string,
    }),
    /** from injectIntl */
    intl: PropTypes.object,
    data: PropTypes.shape({
      loading: PropTypes.bool,
      error: PropTypes.any,
      variables: PropTypes.shape({
        offset: PropTypes.number.isRequired,
        limit: PropTypes.number.isRequired,
      }),
      account: PropTypes.shape({
        id: PropTypes.string.isRequired,
        currency: PropTypes.string.isRequired,
      }),
      expenses: PropTypes.shape({
        nodes: PropTypes.array,
        totalCount: PropTypes.number,
        offset: PropTypes.number,
        limit: PropTypes.number,
      }),
    }),
  };

  getPageMetaData(collective) {
    if (collective) {
      return { title: this.props.intl.formatMessage(messages.title, { collectiveName: collective.name }) };
    } else {
      return { title: `Expenses` };
    }
  }

  hasFilter = memoizeOne(query => {
    return Object.entries(query).some(([key, value]) => key !== 'offset' && key !== 'limit' && value);
  });

  buildFilterLinkParams(params) {
    return {
      ...pick(this.props, ['collectiveSlug', 'parentCollectiveSlug']),
      ...pick(this.props.query, ['limit', 'tag', 'type', 'status', 'amount', 'payout']),
      ...params,
    };
  }

  updateQuery = queryParams => {
    return Router.pushRoute('expenses', this.buildFilterLinkParams(queryParams));
  };

  getTagProps = tag => {
    if (tag === this.props.query.tag) {
      return { type: 'info', closeButtonProps: true };
    }
  };

  renderExpenseTypeFilterTag(type) {
    const isSelected = this.props.query.type === type;
    const params = this.buildFilterLinkParams({ type: isSelected ? null : type });
    return (
      <Link route="expenses" params={params}>
        <ExpenseTypeTag type={type} closeButtonProps={isSelected} />
      </Link>
    );
  }

  render() {
    const { collectiveSlug, data, query } = this.props;
    const hasFilters = this.hasFilter(query);

    if (!data.loading) {
      if (data.error) {
        return <ErrorPage data={data} />;
      } else if (!data.account || !data.expenses?.nodes) {
        return <ErrorPage error={generateNotFoundError(collectiveSlug, true)} log={false} />;
      } else if (!hasFeature(data.account, FEATURES.RECEIVE_EXPENSES)) {
        return <PageFeatureNotSupported />;
      }
    }

    return (
      <Page collective={data.account} {...this.getPageMetaData(data.account)} withoutGlobalStyles>
        <CollectiveNavbar
          collective={data.account}
          isLoading={!data.account}
          selected={Sections.BUDGET}
          callsToAction={{ hasSubmitExpense: true }}
        />
        <Container position="relative" minHeight={[null, 800]}>
          <Box maxWidth={1242} m="0 auto" px={[2, 3, 4]} py={[4, 5]}>
            <Flex justifyContent="space-between" flexWrap="wrap">
              <Box flex="1 1 500px" minWidth={300} maxWidth={792} mr={[0, 3, 5]} mb={5}>
                <H1 fontSize="32px" lineHeight="40px" mb={24} py={2} fontWeight="normal">
                  <FormattedMessage id="section.expenses.title" defaultMessage="Expenses" />
                </H1>
                <StyledHr mb={26} borderWidth="0.5px" />
                <Box mb={34}>
                  {data.account ? (
                    <ExpensesFilters collective={data.account} filters={this.props.query} onChange={this.updateQuery} />
                  ) : (
                    <LoadingPlaceholder height={70} />
                  )}
                </Box>
                {!data.loading && !data.expenses?.nodes.length ? (
                  <MessageBox type="info" withIcon>
                    {hasFilters ? (
                      <FormattedMessage
                        id="ExpensesList.Empty"
                        defaultMessage="No expense matches the given filters, <ResetLink>reset them</ResetLink> to see all expenses."
                        values={{
                          ResetLink: text => (
                            <Link
                              route="expenses"
                              params={this.buildFilterLinkParams(mapValues(this.props.query, () => null))}
                            >
                              {text}
                            </Link>
                          ),
                        }}
                      />
                    ) : (
                      <FormattedMessage id="expenses.empty" defaultMessage="No expenses" />
                    )}
                  </MessageBox>
                ) : (
                  <React.Fragment>
                    <ExpensesList
                      isLoading={data.loading}
                      collective={data.account}
                      expenses={data.expenses?.nodes}
                      nbPlaceholders={data.variables.limit}
                    />
                    <Flex mt={5} justifyContent="center">
                      <Pagination
                        route="expenses"
                        total={data.expenses?.totalCount}
                        limit={data.variables.limit}
                        offset={data.variables.offset}
                        scrollToTopOnChange
                      />
                    </Flex>
                  </React.Fragment>
                )}
              </Box>
              <Box minWidth={270} width={['100%', null, null, 275]} mt={70}>
                <ExpenseInfoSidebar
                  isLoading={data.loading}
                  collective={data.account}
                  host={data.account?.host}
                  tags={data.account?.expensesTags.map(({ tag }) => tag)}
                  showExpenseTypeFilters
                >
                  <H5 mb={3}>
                    <FormattedMessage id="Tags" defaultMessage="Tags" />
                  </H5>
                  <Flex flexWrap="wrap" mb={2}>
                    {this.renderExpenseTypeFilterTag(expenseTypes.RECEIPT)}
                    {this.renderExpenseTypeFilterTag(expenseTypes.INVOICE)}
                  </Flex>
                  <ExpenseTags
                    isLoading={data.loading}
                    expense={{ tags: data.account?.expensesTags.map(({ tag }) => tag) }}
                    limit={30}
                    getTagProps={this.getTagProps}
                  >
                    {({ key, tag, renderedTag, props }) => (
                      <Link
                        key={key}
                        route="expenses"
                        params={this.buildFilterLinkParams({ tag: props.closeButtonProps ? null : tag })}
                      >
                        {renderedTag}
                      </Link>
                    )}
                  </ExpenseTags>
                </ExpenseInfoSidebar>
              </Box>
            </Flex>
          </Box>
        </Container>
      </Page>
    );
  }
}

const EXPENSES_PAGE_QUERY = gqlV2/* GraphQL */ `
  query ExpensesPageQuery(
    $collectiveSlug: String!
    $limit: Int!
    $offset: Int!
    $type: ExpenseType
    $tags: [String]
    $status: ExpenseStatus
    $minAmount: Int
    $maxAmount: Int
    $payoutMethodType: PayoutMethodType
  ) {
    account(slug: $collectiveSlug) {
      id
      slug
      type
      imageUrl
      name
      currency
      expensesTags {
        id
        tag
      }
      ... on Organization {
        balance
        # We add that for hasFeature
        isHost
        isActive
      }
      ... on Event {
        balance
        parentCollective {
          id
          name
          slug
          type
        }
        host {
          id
          name
          slug
          type
        }
      }
      ... on Collective {
        balance
        host {
          id
          name
          slug
          type
        }
      }
    }
    expenses(
      account: { slug: $collectiveSlug }
      limit: $limit
      offset: $offset
      type: $type
      tags: $tags
      status: $status
      minAmount: $minAmount
      maxAmount: $maxAmount
      payoutMethodType: $payoutMethodType
    ) {
      totalCount
      offset
      limit
      nodes {
        id
        legacyId
        description
        status
        createdAt
        tags
        amount
        currency
        type
        payee {
          id
          type
          slug
          imageUrl(height: 80)
        }
        createdByAccount {
          id
          type
          slug
        }
      }
    }
  }
`;

const getData = graphql(EXPENSES_PAGE_QUERY, {
  options: props => {
    const amountRange = parseAmountRange(props.query.amount);
    return {
      context: API_V2_CONTEXT,
      fetchPolicy: 'cache-and-network',
      variables: {
        collectiveSlug: props.collectiveSlug,
        offset: props.query.offset || 0,
        limit: props.query.limit || EXPENSES_PER_PAGE,
        type: props.query.type,
        status: props.query.status,
        tags: props.query.tag ? [props.query.tag] : undefined,
        minAmount: amountRange[0] && amountRange[0] * 100,
        maxAmount: amountRange[1] && amountRange[1] * 100,
        payoutMethodType: props.query.payout,
      },
    };
  },
});

export default injectIntl(getData(ExpensePage));
