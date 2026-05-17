package com.example.app;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;

import javax.persistence.*;
import java.util.List;

@Entity
class User {
    @Id
    @GeneratedValue
    Long id;

    String name;

    // JPA-EAGER-003: explicit FetchType.EAGER on a relation.
    @ManyToOne(fetch = FetchType.EAGER)
    Org org;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    List<Post> posts;
}

@Repository
interface UserRepository extends JpaRepository<User, Long> {
    // JPA-QRY-002: string concat inside @Query.
    @Query("SELECT u FROM User u WHERE u.name = '" + name + "'")
    List<User> findByNameUnsafe(String name);

    @Query("SELECT u FROM User u WHERE u.name = :name")
    List<User> findByNameSafe(String name);
}

@Service
class UserService {
    private final UserRepository userRepo;

    UserService(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    // JPA-N1-001: findById in for-each.
    void loadAll(List<Long> ids) {
        for (Long id : ids) {
            userRepo.findById(id);
        }
    }

    // JPA-SAVE-004: save in for-each.
    void saveAll(List<User> users) {
        for (User u : users) {
            userRepo.save(u);
        }
    }

    void cleanLoadAll(List<Long> ids) {
        // Negative: bulk find — no findings expected.
        userRepo.findAllById(ids);
    }
}
