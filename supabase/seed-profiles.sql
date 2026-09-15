-- Run after creating both users in Authentication → Users.
-- Get each id from the Users list (or: select id, email from auth.users;).

insert into profiles (id, display_name, avatar_emoji) values
  ('00000000-0000-0000-0000-000000000000', 'Deniz',  '🎯'),
  ('00000000-0000-0000-0000-000000000000', 'Friend', '🐢');
