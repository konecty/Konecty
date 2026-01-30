import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { findComments, createComment, updateComment, deleteComment, searchComments } from '@imports/data/comments';
import { searchUsersForMention } from '@imports/data/userSearch';

const commentApi: FastifyPluginCallback = async fastify => {
	// Get comments for a record
	fastify.get<{ Params: { document: string; dataId: string } }>('/rest/comment/:document/:dataId', async (req, reply) => {
		const result = await findComments({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
		});

		return reply.send(result);
	});

	// Create a new comment
	fastify.post<{ Params: { document: string; dataId: string }; Body: { text: string; parentId?: string } }>(
		'/rest/comment/:document/:dataId',
		async (req, reply) => {
			const result = await createComment({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				dataId: req.params.dataId,
				text: req.body.text,
				parentId: req.body.parentId,
			});

			return reply.send(result);
		},
	);

	// Update a comment
	fastify.put<{ Params: { document: string; dataId: string; commentId: string }; Body: { text: string } }>(
		'/rest/comment/:document/:dataId/:commentId',
		async (req, reply) => {
			const result = await updateComment({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				dataId: req.params.dataId,
				commentId: req.params.commentId,
				text: req.body.text,
			});

			return reply.send(result);
		},
	);

	// Delete a comment (soft delete)
	fastify.delete<{ Params: { document: string; dataId: string; commentId: string } }>(
		'/rest/comment/:document/:dataId/:commentId',
		async (req, reply) => {
			const result = await deleteComment({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				dataId: req.params.dataId,
				commentId: req.params.commentId,
			});

			return reply.send(result);
		},
	);

	// Search users for @mention autocomplete
	fastify.get<{ Params: { document: string; dataId: string }; Querystring: { q?: string } }>(
		'/rest/comment/:document/:dataId/users/search',
		async (req, reply) => {
			const result = await searchUsersForMention({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				dataId: req.params.dataId,
				query: req.query.q || '',
			});

			return reply.send(result);
		},
	);

	// Search comments with filters
	fastify.get<{
		Params: { document: string; dataId: string };
		Querystring: {
			q?: string;
			authorId?: string;
			startDate?: string;
			endDate?: string;
			page?: string;
			limit?: string;
		};
	}>('/rest/comment/:document/:dataId/search', async (req, reply) => {
		const result = await searchComments({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
			query: req.query.q,
			authorId: req.query.authorId,
			startDate: req.query.startDate,
			endDate: req.query.endDate,
			page: req.query.page ? parseInt(req.query.page, 10) : undefined,
			limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
		});

		return reply.send(result);
	});
};

export default fp(commentApi);
