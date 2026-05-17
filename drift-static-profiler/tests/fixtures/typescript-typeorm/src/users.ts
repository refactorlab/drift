import { DataSource, Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // TO-EAGER-002: collection with eager:true — issues a JOIN on every load.
  @OneToMany(() => Post, (p) => p.user, { eager: true })
  posts: Post[];
}

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;
}

// TO-SYNC-004: synchronize: true at the data-source construction.
export const dataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  database: "app",
  synchronize: true,
  entities: [User, Post],
});

export class UserService {
  private userRepo = dataSource.getRepository(User);

  async nPlusOne(ids: number[]) {
    // TO-N1-001: findOne in loop.
    const out = [];
    for (const id of ids) {
      const u = await this.userRepo.findOne({ where: { id } });
      out.push(u);
    }
    return out;
  }

  async unsafeSearch(name: string) {
    // TO-QB-003: template-literal interpolation in QueryBuilder.where().
    return this.userRepo
      .createQueryBuilder("u")
      .where(`u.name = '${name}'`)
      .getMany();
  }
}
