import React, { useCallback, Fragment } from 'react';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';

import MailIcon from '@mui/icons-material/Mail';
import ListSubheader from '@mui/material/ListSubheader';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import DraftsIcon from '@mui/icons-material/Drafts';
import SendIcon from '@mui/icons-material/Send';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import StarBorder from '@mui/icons-material/StarBorder';

import userStore, { toggleMenuOpen } from 'ui/store/user';
import getLabel from 'utils/getLabel';

import { makeStyles } from '@mui/styles';

const useStyles = makeStyles(() => ({
	icon: {
		maxWidth: 48,
		overflow: 'hidden',
	},
}));

const MenuItem = ({ entries, classes, handleClick, t }) =>
	(entries ?? []).map(({ _id, group, icon, plurals, label, isOpen, lists, pivots, related }) => (
		<Fragment key={_id}>
			<ListItemButton id={_id} onClick={handleClick({ id: _id, group })}>
				<ListItemIcon>
					<span className={`material-icons md-36 ${classes.icon}`}>{t((icon ?? 'broken_image').replace(/-/g, '_'))}</span>
				</ListItemIcon>
				<ListItemText primary={getLabel(plurals ?? label ?? {})} />
				{isOpen ? <ExpandLess /> : <ExpandMore />}
			</ListItemButton>
			<Collapse in={isOpen} timeout="auto" unmountOnExit>
				<List component="div" disablePadding>
					{(lists ?? []).map(list => (
						// eslint-disable-next-line no-underscore-dangle
						<ListItemButton id={list._id} key={list._id} sx={{ pl: 4 }}>
							<ListItemIcon>
								<span className={`material-icons md-36 ${classes.icon}`}>{t(list.icon ?? 'view_list')}</span>
							</ListItemIcon>
							<ListItemText primary={getLabel(list.plurals ?? list.label ?? {})} />
						</ListItemButton>
					))}
					{(pivots ?? []).map(pivot => (
						// eslint-disable-next-line no-underscore-dangle
						<ListItemButton id={pivot._id} key={pivot._id} sx={{ pl: 4 }}>
							<ListItemIcon>
								<span className={`material-icons md-36 ${classes.icon}`}>{t(pivot.icon ?? 'summarize')}</span>
							</ListItemIcon>
							<ListItemText primary={getLabel(pivot.plurals ?? pivot.label ?? {})} />
						</ListItemButton>
					))}
					{(related ?? []).length > 0 && <MenuItem entries={related} classes={classes} handleClick={handleClick} t={t} />}
					{/* {(related ?? []).map(r => ()} */}
				</List>
			</Collapse>
		</Fragment>
	));

const Menu = () => {
	const { user, mainMenu } = useSnapshot(userStore);
	const { t } = useTranslation();
	const classes = useStyles();

	const handleClick = useCallback(
		({ id, group }) =>
			event => {
				event.stopPropagation();
				toggleMenuOpen({ id, group });
			},
		[],
	);

	return (
		<List
			sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
			component="nav"
			aria-labelledby="nested-list-subheader"
			subheader={
				<ListSubheader component="div" id="nested-list-subheader">
					{user?.name}
				</ListSubheader>
			}
		>
			<MenuItem entries={mainMenu} classes={classes} handleClick={handleClick} t={t} />
		</List>
	);
};

export default Menu;
