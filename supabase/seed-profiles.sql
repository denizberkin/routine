-- Run after creating both users in Authentication → Users.
-- Get each id from the Users list (or: select id, email from auth.users;).

insert into profiles (id, display_name, avatar_emoji) values
  ('3662c4ab-93de-4ad5-b43a-49c554b60a0f', 'Deniz',  '🎯'),
  ('9c804e2c-39bf-4590-b3a1-00554f3be561', 'Dummy', '🐢');
